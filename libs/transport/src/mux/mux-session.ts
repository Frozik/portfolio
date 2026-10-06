import type { IBidirectionalStream, ITransportSession } from '../shared/session';
import type { IMessageSocket } from './message-socket';
import { SOCKET_CLOSE_NORMAL, SOCKET_CLOSE_PROTOCOL_ERROR } from './message-socket';
import { MUX_DEFAULT_SEND_BUFFER, MUX_PROTOCOL_LIMITS } from './mux-limits';
import type { MuxMessage } from './mux-message';
import { MUX_TYPE, MuxProtocolError } from './mux-message';
import type { MuxStreamLimits } from './mux-stream';
import { MuxStream } from './mux-stream';
import type { IMuxWire } from './mux-wire';

export interface MuxSessionOptions extends MuxStreamLimits {
  /** Clients open odd stream ids, servers even ones — as in QUIC — so ids never collide. */
  readonly role: 'client' | 'server';
  readonly maxIncomingStreams: number;
  /** DATA waits while the socket holds more than this many unsent bytes. */
  readonly sendBufferBytes: number;
  readonly drainPollMs: number;
  readonly wire: IMuxWire;
}

export function muxSessionOptions(
  role: MuxSessionOptions['role'],
  maxIncomingStreams: number,
  wire: IMuxWire
): MuxSessionOptions {
  return { ...MUX_PROTOCOL_LIMITS, ...MUX_DEFAULT_SEND_BUFFER, role, maxIncomingStreams, wire };
}

const FIRST_STREAM_ID = { client: 1, server: 2 } as const;
const STREAM_ID_STEP = 2;

/** WebTransport-shaped session over one WebSocket: the fallback when HTTP/3 is unreachable. */
export function createMuxSession(
  socket: IMessageSocket,
  options: MuxSessionOptions
): ITransportSession {
  return new MuxSession(socket, options);
}

class MuxSession implements ITransportSession {
  readonly ready: Promise<void>;
  readonly closed: Promise<void>;
  readonly incomingBidirectionalStreams: ReadableStream<IBidirectionalStream>;

  private readonly streams = new Map<number, MuxStream>();
  private incomingController: ReadableStreamDefaultController<IBidirectionalStream> | undefined;
  private nextStreamId: number;
  private failure: Error | undefined;

  constructor(
    private readonly socket: IMessageSocket,
    private readonly options: MuxSessionOptions
  ) {
    this.nextStreamId = FIRST_STREAM_ID[options.role];
    this.incomingBidirectionalStreams = new ReadableStream<IBidirectionalStream>({
      start: controller => {
        this.incomingController = controller;
      },
    });
    this.ready = socket.opened;
    this.closed = socket.closed.then(() => this.shutdown(new Error('session closed')));
    socket.onMessage(message => this.receive(message));
  }

  async createBidirectionalStream(): Promise<IBidirectionalStream> {
    await this.socket.opened;
    if (this.failure !== undefined) {
      throw this.failure;
    }
    const streamId = this.nextStreamId;
    this.nextStreamId += STREAM_ID_STEP;
    const stream = this.track(streamId);
    this.sendControl({ type: MUX_TYPE.open, streamId });
    return stream;
  }

  close(): void {
    this.socket.close(SOCKET_CLOSE_NORMAL, 'session closed');
  }

  private track(streamId: number): MuxStream {
    const stream = new MuxStream(
      streamId,
      {
        sendControl: message => this.sendControl(message),
        sendData: message => this.sendData(message),
        violation: reason => this.violation(reason),
        released: id => this.streams.delete(id),
      },
      this.options
    );
    this.streams.set(streamId, stream);
    return stream;
  }

  private receive(encoded: Uint8Array | string): void {
    if (this.failure !== undefined) {
      return;
    }
    let message: MuxMessage;
    try {
      message = this.options.wire.decode(encoded, this.options.maxDataBytes);
    } catch (error) {
      this.violation(error instanceof MuxProtocolError ? error.message : String(error));
      return;
    }
    if (message.type === MUX_TYPE.open) {
      this.acceptIncoming(message.streamId);
      return;
    }
    const stream = this.streams.get(message.streamId);
    if (stream === undefined) {
      return;
    }
    switch (message.type) {
      case MUX_TYPE.data:
        stream.receiveData(message.bytes);
        return;
      case MUX_TYPE.fin:
        stream.receiveFin();
        return;
      case MUX_TYPE.credit:
        stream.receiveCredit(message.bytes);
        return;
      case MUX_TYPE.reset:
        stream.receiveReset();
        return;
    }
  }

  private acceptIncoming(streamId: number): void {
    const opensOwnIds =
      streamId % STREAM_ID_STEP === FIRST_STREAM_ID[this.options.role] % STREAM_ID_STEP;
    if (streamId === 0 || opensOwnIds || this.streams.has(streamId)) {
      this.violation(`invalid OPEN for stream ${streamId}`);
      return;
    }
    if (this.incomingCount() >= this.options.maxIncomingStreams) {
      this.sendControl({ type: MUX_TYPE.reset, streamId });
      return;
    }
    this.incomingController?.enqueue(this.track(streamId));
  }

  private incomingCount(): number {
    const parity = FIRST_STREAM_ID[this.options.role] % STREAM_ID_STEP;
    let count = 0;
    for (const streamId of this.streams.keys()) {
      if (streamId % STREAM_ID_STEP !== parity) {
        count += 1;
      }
    }
    return count;
  }

  private sendControl(message: MuxMessage): void {
    if (this.failure === undefined) {
      this.socket.send(this.options.wire.encode(message));
    }
  }

  private async sendData(message: MuxMessage): Promise<void> {
    while (
      this.socket.bufferedAmount > this.options.sendBufferBytes &&
      this.failure === undefined
    ) {
      await new Promise(resolve => setTimeout(resolve, this.options.drainPollMs));
    }
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.socket.send(this.options.wire.encode(message));
  }

  private violation(reason: string): void {
    this.socket.close(SOCKET_CLOSE_PROTOCOL_ERROR, reason);
    this.shutdown(new MuxProtocolError(reason));
  }

  private shutdown(error: Error): void {
    if (this.failure !== undefined) {
      return;
    }
    this.failure = error;
    for (const stream of this.streams.values()) {
      stream.fail(error);
    }
    this.streams.clear();
    this.incomingController?.close();
  }
}
