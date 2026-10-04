import type { MessageInitShape } from '@bufbuild/protobuf';
import type { HandlerContext, ServiceImpl } from '@connectrpc/connect';
import { Code, ConnectError } from '@connectrpc/connect';
import type {
  EchoRequest,
  EchoResponseSchema,
  FileService,
} from '@frozik/proto/frozik/transport/v1/file_pb';

import { TRANSPORT_CLIENT_ADDRESS } from '@frozik/transport/server/peer';
import { Crc32 } from '@frozik/utils/hash/crc32';

import type { Sleeper } from '../../application/transport/byte-stream-guards';
import { throttled } from '../../application/transport/byte-stream-guards';
import type { EchoAdmission, EchoRefusal } from '../../application/transport/EchoAdmission';

interface EchoLimits {
  readonly maxFileBytes: number;
  readonly bytesPerIpPerHour: number;
  readonly rateBytesPerSecond: number;
  readonly maxChunkBytes: number;
}

export interface FileServiceDependencies {
  readonly admission: EchoAdmission;
  readonly limits: EchoLimits;
  readonly sleeper: Sleeper;
  readonly onEchoed: (bytes: number) => void;
  readonly onRejected: (reason: EchoRefusal | 'invalid-request') => void;
}

type EchoReply = MessageInitShape<typeof EchoResponseSchema>;

/** Streams the file straight back: one chunk in flight in the handler, the rest held back by flow control. */
export function createFileService(
  dependencies: FileServiceDependencies
): ServiceImpl<typeof FileService> {
  const { limits } = dependencies;
  return {
    getEchoLimits: () => ({
      maxFileBytes: BigInt(limits.maxFileBytes),
      bytesPerHour: BigInt(limits.bytesPerIpPerHour),
      rateBytesPerSecond: BigInt(limits.rateBytesPerSecond),
      maxChunkBytes: limits.maxChunkBytes,
    }),
    echo: (requests, context) => echo(requests, context, dependencies),
  };
}

async function* echo(
  requests: AsyncIterable<EchoRequest>,
  context: HandlerContext,
  { admission, limits, sleeper, onEchoed, onRejected }: FileServiceDependencies
): AsyncGenerator<EchoReply> {
  const iterator = requests[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done === true || first.value.part.case !== 'header') {
    onRejected('invalid-request');
    throw new ConnectError('the first message must carry the file header', Code.InvalidArgument);
  }
  const declaredBytes = Number(first.value.part.value.size);
  if (declaredBytes > limits.maxFileBytes) {
    onRejected('invalid-request');
    throw new ConnectError(`files up to ${limits.maxFileBytes} bytes`, Code.InvalidArgument);
  }
  const ticket = admission.admit(context.values.get(TRANSPORT_CLIENT_ADDRESS), declaredBytes);
  if (!ticket.ok) {
    onRejected(ticket.error);
    throw new ConnectError(ticket.error, Code.ResourceExhausted);
  }
  try {
    const crc = new Crc32();
    let bytes = 0;
    let largestChunk = 0;
    const chunks = throttled(
      chunksAfterHeader(iterator),
      chunk => chunk.byteLength,
      limits.rateBytesPerSecond,
      sleeper,
      context.signal
    );
    for await (const chunk of chunks) {
      bytes += chunk.byteLength;
      if (bytes > declaredBytes || chunk.byteLength > limits.maxChunkBytes) {
        onRejected('invalid-request');
        throw new ConnectError('more bytes than the header declared', Code.InvalidArgument);
      }
      crc.update(chunk);
      largestChunk = Math.max(largestChunk, chunk.byteLength);
      yield { part: { case: 'chunk', value: chunk } };
      onEchoed(chunk.byteLength);
    }
    yield {
      part: {
        case: 'summary',
        value: { bytes: BigInt(bytes), crc32: crc.value, maxBufferedBytes: BigInt(largestChunk) },
      },
    };
  } finally {
    ticket.value.release();
  }
}

async function* chunksAfterHeader(
  iterator: AsyncIterator<EchoRequest>
): AsyncGenerator<Uint8Array> {
  for (;;) {
    const next = await iterator.next();
    if (next.done === true) {
      return;
    }
    if (next.value.part.case !== 'chunk') {
      throw new ConnectError('only chunks may follow the header', Code.InvalidArgument);
    }
    yield next.value.part.value;
  }
}
