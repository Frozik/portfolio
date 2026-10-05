import { create } from '@bufbuild/protobuf';
import type { ConnectRouter } from '@connectrpc/connect';
import { Code, ConnectError, createClient, createConnectRouter } from '@connectrpc/connect';
import type { EchoRequest } from '@frozik/proto/frozik/transport/v1/file_pb';
import { EchoRequestSchema, FileService } from '@frozik/proto/frozik/transport/v1/file_pb';
import {
  ExpressionErrorReason,
  ExpressionErrorSchema,
  PlotService,
} from '@frozik/proto/frozik/transport/v1/plot_pb';

import { createMemorySessionPair } from '../testing/memory-session';
import { serveConnectSession } from '../tunnel/serve-connect-session';
import { createSessionTransport } from './session-transport';

const READ_MAX_BYTES = 1024 * 1024;
const STALL_WAIT_MS = 80;
const IDLE_TIMEOUT_MS = 50;
const CONTENT_TYPE = 'content-type';

function connect(
  register: (router: ConnectRouter) => void,
  streamIdleTimeoutMs = 5_000,
  maxStreams = 8
) {
  const { client, server } = createMemorySessionPair();
  const router = createConnectRouter({ readMaxBytes: READ_MAX_BYTES });
  register(router);
  void serveConnectSession(server, {
    handlers: router.handlers,
    maxStreams,
    streamIdleTimeoutMs,
    onStreamError: () => undefined,
  });
  return createSessionTransport({
    openStream: () => client.createBidirectionalStream(),
    baseUrl: 'https://transport.test',
    readMaxBytes: READ_MAX_BYTES,
  });
}

async function* fileRequests(chunks: number, chunkBytes: number): AsyncGenerator<EchoRequest> {
  yield create(EchoRequestSchema, { part: { case: 'header', value: { name: 'a', size: 0n } } });
  for (let index = 0; index < chunks; index += 1) {
    yield create(EchoRequestSchema, {
      part: { case: 'chunk', value: new Uint8Array(chunkBytes).fill(index & 0xff) },
    });
  }
}

describe('Connect over a transport session', () => {
  it('answers a unary call in JSON when the method moves no bytes', async () => {
    let contentType: string | null = null;
    const transport = connect(router =>
      router.service(PlotService, {
        getPlotLimits: (_, context) => {
          contentType = context.requestHeader.get(CONTENT_TYPE);
          return { expressionMaxLength: 200, sampleMaxPoints: 5000 };
        },
      })
    );

    const limits = await createClient(PlotService, transport).getPlotLimits({});

    expect(limits.expressionMaxLength).toBe(200);
    expect(contentType).toBe('application/json');
  });

  it('streams server messages in order', async () => {
    const transport = connect(router =>
      router.service(PlotService, {
        async *sample(request) {
          for (let index = 0; index < 3; index += 1) {
            yield { x: [index], y: [request.xMin + index] };
          }
        },
      })
    );

    const chunks = [];
    for await (const chunk of createClient(PlotService, transport).sample({ xMin: 10 })) {
      chunks.push(chunk.y[0]);
    }

    expect(chunks).toEqual([10, 11, 12]);
  });

  it('carries a typed error detail from server to client', async () => {
    const transport = connect(router =>
      router.service(PlotService, {
        // oxlint-disable-next-line require-yield -- the method fails before producing anything
        async *sample() {
          throw new ConnectError('bad expression', Code.InvalidArgument, undefined, [
            {
              desc: ExpressionErrorSchema,
              value: { position: 4, reason: ExpressionErrorReason.UNEXPECTED_TOKEN },
            },
          ]);
        },
      })
    );

    const failure = await Array.fromAsync(createClient(PlotService, transport).sample({})).then(
      () => undefined,
      (error: unknown) => ConnectError.from(error)
    );

    expect(failure?.code).toBe(Code.InvalidArgument);
    expect(failure?.findDetails(ExpressionErrorSchema)).toEqual([
      expect.objectContaining({ position: 4, reason: ExpressionErrorReason.UNEXPECTED_TOKEN }),
    ]);
  });

  it('echoes a bidirectional byte stream intact in binary protobuf', async () => {
    let contentType: string | null = null;
    const transport = connect(router =>
      router.service(FileService, {
        async *echo(requests, context) {
          contentType = context.requestHeader.get(CONTENT_TYPE);
          for await (const request of requests) {
            if (request.part.case === 'chunk') {
              yield { part: { case: 'chunk', value: request.part.value } };
            }
          }
        },
      })
    );

    let received = 0;
    let checksum = 0;
    for await (const response of createClient(FileService, transport).echo(
      fileRequests(40, 32 * 1024)
    )) {
      if (response.part.case === 'chunk') {
        received += response.part.value.byteLength;
        checksum += response.part.value[0] ?? 0;
      }
    }

    expect(received).toBe(40 * 32 * 1024);
    expect(checksum).toBe((39 * 40) / 2);
    expect(contentType).toBe('application/connect+proto');
  });

  it('stops pulling the client file while the client does not read the echo', async () => {
    let pulled = 0;
    async function* endless(): AsyncGenerator<EchoRequest> {
      yield create(EchoRequestSchema, { part: { case: 'header', value: { name: 'a', size: 0n } } });
      for (;;) {
        pulled += 1;
        yield create(EchoRequestSchema, {
          part: { case: 'chunk', value: new Uint8Array(16 * 1024) },
        });
      }
    }
    const transport = connect(router =>
      router.service(FileService, {
        async *echo(requests) {
          for await (const request of requests) {
            if (request.part.case === 'chunk') {
              yield { part: { case: 'chunk', value: request.part.value } };
            }
          }
        },
      })
    );
    const controller = new AbortController();
    const responses = createClient(FileService, transport).echo(endless(), {
      signal: controller.signal,
    });
    const iterator = responses[Symbol.asyncIterator]();
    await iterator.next();

    await new Promise(resolve => setTimeout(resolve, STALL_WAIT_MS));
    const pulledWhileStalled = pulled;
    await new Promise(resolve => setTimeout(resolve, STALL_WAIT_MS));

    expect(pulled).toBe(pulledWhileStalled);
    expect(pulled * 16 * 1024).toBeLessThan(4 * 1024 * 1024);
    controller.abort();
  });

  it('frees a call whose client stopped reading the response once nothing moves', async () => {
    let released = false;
    const transport = connect(
      router =>
        router.service(FileService, {
          async *echo(requests) {
            try {
              for await (const request of requests) {
                if (request.part.case === 'chunk') {
                  yield { part: { case: 'chunk', value: request.part.value } };
                }
              }
            } finally {
              released = true;
            }
          },
        }),
      IDLE_TIMEOUT_MS
    );
    async function* endless(): AsyncGenerator<EchoRequest> {
      for (;;) {
        yield create(EchoRequestSchema, {
          part: { case: 'chunk', value: new Uint8Array(16 * 1024) },
        });
      }
    }
    const responses = createClient(FileService, transport).echo(endless());
    const reading = responses[Symbol.asyncIterator]().next();

    await new Promise(resolve => setTimeout(resolve, IDLE_TIMEOUT_MS * 4));

    expect(released).toBe(true);
    await reading.catch(() => undefined);
  });

  it('waits for a handler still cleaning up instead of refusing the call that replaced it', async () => {
    const CLEANUP_MS = 50;
    const transport = connect(
      router =>
        router.service(PlotService, {
          async *sample(request, context) {
            if (request.xMin === 0) {
              await new Promise(resolve => context.signal.addEventListener('abort', resolve));
              await new Promise(resolve => setTimeout(resolve, CLEANUP_MS));
              return;
            }
            yield { x: [request.xMin], y: [1] };
          },
        }),
      5_000,
      1
    );
    const client = createClient(PlotService, transport);
    const controller = new AbortController();
    const superseded = Array.fromAsync(
      client.sample({ xMin: 0 }, { signal: controller.signal })
    ).catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, 10));

    controller.abort();
    const replacement = await Array.fromAsync(client.sample({ xMin: 7 }));

    expect(replacement.map(chunk => chunk.x[0])).toEqual([7]);
    await superseded;
  });
});
