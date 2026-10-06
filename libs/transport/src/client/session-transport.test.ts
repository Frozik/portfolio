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

import type { TraceContext } from '../shared/trace-context';
import { TRACEPARENT_HEADER, TRANSPORT_TRACE } from '../shared/trace-context';
import type { WireFormat } from '../shared/wire-format';
import { createMemorySessionPair, TEST_MUX_LIMITS } from '../testing/memory-session';
import { serveConnectSession } from '../tunnel/serve-connect-session';
import { traceIdOf } from './call-trace';
import { createSessionTransport } from './session-transport';

const READ_MAX_BYTES = 1024 * 1024;
const STALL_WAIT_MS = 80;
const IDLE_TIMEOUT_MS = 50;
const CONTENT_TYPE = 'content-type';

interface ConnectOptions {
  readonly streamIdleTimeoutMs?: number;
  readonly maxStreams?: number;
  readonly format?: WireFormat;
  readonly onStreamError?: (error: unknown, trace: TraceContext | undefined) => void;
}

/** The content type a unary call that moves no bytes is sent with. */
const UNARY_CONTENT_TYPE: Readonly<Record<WireFormat, string>> = {
  binary: 'application/proto',
  json: 'application/json',
};

function connect(
  register: (router: ConnectRouter) => void,
  {
    streamIdleTimeoutMs = 5_000,
    maxStreams = 8,
    format = 'binary',
    onStreamError = () => undefined,
  }: ConnectOptions = {}
) {
  const { client, server } = createMemorySessionPair(TEST_MUX_LIMITS, format);
  const router = createConnectRouter({ readMaxBytes: READ_MAX_BYTES });
  register(router);
  void serveConnectSession(server, {
    handlers: router.handlers,
    maxStreams,
    streamIdleTimeoutMs,
    onStreamError,
  });
  return createSessionTransport({
    openStream: () => client.createBidirectionalStream(),
    baseUrl: 'https://transport.test',
    readMaxBytes: READ_MAX_BYTES,
    wireFormat: () => format,
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

describe.each(['binary', 'json'] as const)('Connect over the %s wire', format => {
  it('answers a unary call in the codec the wire format picks', async () => {
    let contentType: string | null = null;
    const transport = connect(
      router =>
        router.service(PlotService, {
          getPlotLimits: (_, context) => {
            contentType = context.requestHeader.get(CONTENT_TYPE);
            return { expressionMaxLength: 200, sampleMaxPoints: 5000 };
          },
        }),
      { format }
    );

    const limits = await createClient(PlotService, transport).getPlotLimits({});

    expect(limits.expressionMaxLength).toBe(200);
    expect(contentType).toBe(UNARY_CONTENT_TYPE[format]);
  });

  it('streams server messages in order', async () => {
    const transport = connect(
      router =>
        router.service(PlotService, {
          async *sample(request) {
            for (let index = 0; index < 3; index += 1) {
              yield { x: [index], y: [request.xMin + index] };
            }
          },
        }),
      { format }
    );

    const chunks = [];
    for await (const chunk of createClient(PlotService, transport).sample({ xMin: 10 })) {
      chunks.push(chunk.y[0]);
    }

    expect(chunks).toEqual([10, 11, 12]);
  });

  it('carries a typed error detail from server to client', async () => {
    const transport = connect(
      router =>
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
        }),
      { format }
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

  it('echoes a bidirectional byte stream intact in binary protobuf, whatever the format', async () => {
    let contentType: string | null = null;
    const transport = connect(
      router =>
        router.service(FileService, {
          async *echo(requests, context) {
            contentType = context.requestHeader.get(CONTENT_TYPE);
            for await (const request of requests) {
              if (request.part.case === 'chunk') {
                yield { part: { case: 'chunk', value: request.part.value } };
              }
            }
          },
        }),
      { format }
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
});

describe('Connect over a transport session', () => {
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

  it('ties a call that fails mid-stream to one trace id, from the client through the handler', async () => {
    let handlerTraceId: string | undefined;
    const transport = connect(router =>
      router.service(PlotService, {
        async *sample(_, context) {
          handlerTraceId = context.values.get(TRANSPORT_TRACE)?.traceId;
          yield { x: [0], y: [0] };
          throw new ConnectError('sampler broke', Code.Internal);
        },
      })
    );

    const failure = await Array.fromAsync(createClient(PlotService, transport).sample({})).then(
      () => undefined,
      (error: unknown) => error
    );

    expect(handlerTraceId).toMatch(/^[\da-f]{32}$/);
    expect(traceIdOf(failure)).toBe(handlerTraceId);
  });

  it('keeps the trace a caller already started, such as an OpenTelemetry span', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    let seen: string | null = null;
    const transport = connect(router =>
      router.service(PlotService, {
        getPlotLimits: (_, context) => {
          seen = context.requestHeader.get(TRACEPARENT_HEADER);
          return {};
        },
      })
    );

    await createClient(PlotService, transport).getPlotLimits(
      {},
      { headers: { [TRACEPARENT_HEADER]: `00-${traceId}-00f067aa0ba902b7-01` } }
    );

    expect(seen).toBe(`00-${traceId}-00f067aa0ba902b7-01`);
  });

  it('names the trace of a call the transport had to drop', async () => {
    let handlerTraceId: string | undefined;
    const dropped = Promise.withResolvers<string | undefined>();
    const transport = connect(
      router =>
        router.service(PlotService, {
          // oxlint-disable-next-line require-yield -- the handler hangs until the transport drops it
          async *sample(_, context) {
            handlerTraceId = context.values.get(TRANSPORT_TRACE)?.traceId;
            await new Promise(resolve => context.signal.addEventListener('abort', resolve));
          },
        }),
      {
        streamIdleTimeoutMs: IDLE_TIMEOUT_MS,
        onStreamError: (_, trace) => dropped.resolve(trace?.traceId),
      }
    );

    const call = Array.fromAsync(createClient(PlotService, transport).sample({}));

    expect(await dropped.promise).toBe(handlerTraceId);
    await call.catch(() => undefined);
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
      { streamIdleTimeoutMs: IDLE_TIMEOUT_MS }
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
      { maxStreams: 1 }
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
