import type { Frame } from './frame';
import { FrameProtocolError, MAX_DATA_FRAME_BYTES } from './frame';
import { encodeFrame, FrameDecoder } from './frame-codec';
import { settleTeardown } from './settle';

/** Called whenever bytes actually move, so a watchdog can tell a slow stream from a stuck one. */
type OnProgress = () => void;

const NO_PROGRESS_LISTENER: OnProgress = () => undefined;

/** Writes frames one at a time; every write waits for the stream, which is what carries backpressure. */
export class FrameWriter {
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;

  constructor(
    writable: WritableStream<Uint8Array>,
    private readonly onProgress: OnProgress = NO_PROGRESS_LISTENER
  ) {
    this.writer = writable.getWriter();
  }

  async head(json: unknown): Promise<void> {
    await this.write({ kind: 'head', json });
  }

  async body(chunks: AsyncIterable<Uint8Array>): Promise<void> {
    for await (const chunk of chunks) {
      for (let offset = 0; offset < chunk.byteLength; offset += MAX_DATA_FRAME_BYTES) {
        await this.write({
          kind: 'data',
          bytes: chunk.subarray(offset, offset + MAX_DATA_FRAME_BYTES),
        });
      }
    }
  }

  async end(json: unknown): Promise<void> {
    await this.write({ kind: 'end', json });
    await this.writer.close();
  }

  abort(reason: unknown): void {
    settleTeardown(this.writer.abort(reason));
  }

  private async write(frame: Frame): Promise<void> {
    await this.writer.ready;
    await this.writer.write(encodeFrame(frame));
    this.onProgress();
  }
}

/** Reads `HEAD · DATA* · END` and refuses any other order. */
export class FrameReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new FrameDecoder();
  private readonly pending: Frame[] = [];

  constructor(
    readable: ReadableStream<Uint8Array>,
    private readonly onProgress: OnProgress = NO_PROGRESS_LISTENER
  ) {
    this.reader = readable.getReader();
  }

  async head(): Promise<unknown> {
    const frame = await this.next();
    if (frame?.kind !== 'head') {
      throw new FrameProtocolError('stream must start with a HEAD frame');
    }
    return frame.json;
  }

  /** Yields DATA payloads until END, then hands END's JSON to `onEnd`. */
  async *body(onEnd: (json: unknown) => void): AsyncGenerator<Uint8Array> {
    for (;;) {
      const frame = await this.next();
      if (frame === undefined) {
        throw new FrameProtocolError('stream ended before the END frame');
      }
      switch (frame.kind) {
        case 'data':
          yield frame.bytes;
          break;
        case 'end':
          onEnd(frame.json);
          return;
        case 'head':
          throw new FrameProtocolError('unexpected HEAD frame inside a body');
      }
    }
  }

  cancel(reason: unknown): void {
    settleTeardown(this.reader.cancel(reason));
  }

  private async next(): Promise<Frame | undefined> {
    while (this.pending.length === 0) {
      const { value, done } = await this.reader.read();
      if (done) {
        if (this.decoder.hasPartialFrame) {
          throw new FrameProtocolError('stream ended inside a frame');
        }
        return undefined;
      }
      this.onProgress();
      this.pending.push(...this.decoder.push(value));
    }
    return this.pending.shift();
  }
}
