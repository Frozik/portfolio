import { create } from '@bufbuild/protobuf';
import type { Transport } from '@connectrpc/connect';
import { createClient } from '@connectrpc/connect';
import type {
  EchoRequest as WireEchoRequest,
  EchoResponse as WireEchoResponse,
} from '@frozik/proto/frozik/transport/v1/file_pb';
import { EchoRequestSchema, FileService } from '@frozik/proto/frozik/transport/v1/file_pb';
import { Crc32 } from '@frozik/utils/hash/crc32';

import { CallFailedError } from '../domain/call-failure';
import type { EchoSummary } from '../domain/echo';
import type { EchoRequest, IFileEcho } from '../domain/ports/file-echo';
import { toCallFailedError } from './call-failure-mapping';

/**
 * The file echo over Connect: one bidirectional stream per file.
 *
 * Two loops run against each other — `readSource` turns the file into
 * requests, `writeEcho` writes the responses to disk — and neither buffers:
 * Connect pulls the next request only when the stream has room, and the next
 * response is read only after the previous one is written. A slow disk
 * therefore slows the reading of the source file.
 */
export function createFileEcho(transport: Transport): IFileEcho {
  const files = createClient(FileService, transport);

  return {
    async limits(signal) {
      try {
        const limits = await files.getEchoLimits({}, { signal });
        return {
          maxFileBytes: Number(limits.maxFileBytes),
          bytesPerHour: Number(limits.bytesPerHour),
          rateBytesPerSecond: Number(limits.rateBytesPerSecond),
          maxChunkBytes: limits.maxChunkBytes,
        };
      } catch (error) {
        throw toCallFailedError(error);
      }
    },

    async echo(request) {
      const sent = new ByteCount();
      const received = new ByteCount();
      const report = () =>
        request.onProgress({ sentBytes: sent.bytes, receivedBytes: received.bytes });
      try {
        const requests = readSource(request, chunk => {
          sent.add(chunk);
          report();
        });
        const responses = files.echo(requests, { signal: request.signal });
        const summary = await writeEcho(responses, request.destination, chunk => {
          received.add(chunk);
          report();
        });
        return {
          summary,
          tally: {
            declaredBytes: request.source.size,
            sentBytes: sent.bytes,
            sentCrc32: sent.crc32,
            receivedBytes: received.bytes,
            receivedCrc32: received.crc32,
          },
        };
      } catch (error) {
        throw toCallFailedError(error);
      }
    },
  };
}

/** Reading: the header, then the file in chunks no larger than the server takes. */
async function* readSource(
  { source, maxChunkBytes }: EchoRequest,
  onChunk: (chunk: Uint8Array) => void
): AsyncGenerator<WireEchoRequest> {
  yield create(EchoRequestSchema, {
    part: { case: 'header', value: { name: source.name, size: BigInt(source.size) } },
  });
  const reader = source.stream().getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        return;
      }
      for (let offset = 0; offset < value.byteLength; offset += maxChunkBytes) {
        const chunk = value.subarray(offset, offset + maxChunkBytes);
        onChunk(chunk);
        yield create(EchoRequestSchema, { part: { case: 'chunk', value: chunk } });
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Writing: every chunk that comes back goes to disk; the server's summary closes the stream. */
async function writeEcho(
  responses: AsyncIterable<WireEchoResponse>,
  destination: WritableStream<Uint8Array>,
  onChunk: (chunk: Uint8Array) => void
): Promise<EchoSummary> {
  const writer = destination.getWriter();
  try {
    let summary: EchoSummary | undefined;
    for await (const { part } of responses) {
      if (part.case === 'chunk') {
        onChunk(part.value);
        await writer.write(part.value);
      } else if (part.case === 'summary') {
        summary = {
          bytes: Number(part.value.bytes),
          crc32: part.value.crc32,
          maxBufferedBytes: Number(part.value.maxBufferedBytes),
        };
      }
    }
    if (summary === undefined) {
      throw new CallFailedError({
        kind: 'unreachable',
        message: 'the echo ended without a summary',
      });
    }
    await writer.close();
    return summary;
  } catch (error) {
    await writer.abort(error);
    throw error;
  }
}

/** How many bytes went one way, and their CRC-32, to compare with the other way. */
class ByteCount {
  bytes = 0;
  private readonly crc = new Crc32();

  get crc32(): number {
    return this.crc.value;
  }

  add(chunk: Uint8Array): void {
    this.bytes += chunk.byteLength;
    this.crc.update(chunk);
  }
}
