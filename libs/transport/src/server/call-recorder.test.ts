import { create } from '@bufbuild/protobuf';
import type { ConnectRouter } from '@connectrpc/connect';
import { Code, ConnectError, createClient, createConnectRouter } from '@connectrpc/connect';
import type { EchoRequest } from '@frozik/proto/frozik/transport/v1/file_pb';
import { EchoRequestSchema, FileService } from '@frozik/proto/frozik/transport/v1/file_pb';
import { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';

import { traceIdOf } from '../client/call-trace';
import { createSessionTransport } from '../client/session-transport';
import { TRANSPORT_TRACE } from '../shared/trace-context';
import { createMemorySessionPair } from '../testing/memory-session';
import { serveConnectSession } from '../tunnel/serve-connect-session';
import type { CallRecord } from './call-recorder';
import { createCallRecorder } from './call-recorder';

const READ_MAX_BYTES = 1024 * 1024;

function recordedServer(register: (router: ConnectRouter) => void) {
  const records: CallRecord[] = [];
  const { client, server } = createMemorySessionPair();
  const router = createConnectRouter({
    readMaxBytes: READ_MAX_BYTES,
    interceptors: [createCallRecorder(record => records.push(record))],
  });
  register(router);
  void serveConnectSession(server, {
    handlers: router.handlers,
    maxStreams: 8,
    streamIdleTimeoutMs: 5_000,
    onStreamError: () => undefined,
  });
  const transport = createSessionTransport({
    openStream: () => client.createBidirectionalStream(),
    baseUrl: 'https://transport.test',
    readMaxBytes: READ_MAX_BYTES,
    wireFormat: () => 'binary',
  });
  return { records, transport };
}

async function* fileOf(chunks: number): AsyncGenerator<EchoRequest> {
  yield create(EchoRequestSchema, { part: { case: 'header', value: { name: 'a.bin', size: 1n } } });
  for (let index = 0; index < chunks; index += 1) {
    yield create(EchoRequestSchema, { part: { case: 'chunk', value: new Uint8Array(32 * 1024) } });
  }
}

describe('call recorder', () => {
  it('reports a finished stream once, with what the client asked and under its trace', async () => {
    let handlerTraceId: string | undefined;
    const { records, transport } = recordedServer(router =>
      router.service(PlotService, {
        async *sample(request, context) {
          handlerTraceId = context.values.get(TRANSPORT_TRACE)?.traceId;
          yield { x: [request.xMin], y: [0] };
          yield { x: [request.xMax], y: [1] };
        },
      })
    );

    await Array.fromAsync(
      createClient(PlotService, transport).sample({ expression: 'x', xMin: 0, xMax: 1, points: 2 })
    );

    expect(records).toEqual([
      expect.objectContaining({
        traceId: handlerTraceId,
        procedure: 'frozik.transport.v1.PlotService/Sample',
        requests: [{ expression: 'x', xMax: 1, points: 2 }],
        requestCount: 1,
        responseCount: 2,
        outcome: { kind: 'ok' },
      }),
    ]);
  });

  it('reports a failure with the error, under the trace id the client was handed', async () => {
    const { records, transport } = recordedServer(router =>
      router.service(PlotService, {
        getPlotLimits: () => {
          throw new ConnectError('limits are gone', Code.Internal);
        },
      })
    );

    const failure = await createClient(PlotService, transport)
      .getPlotLimits({})
      .catch((error: unknown) => error);

    expect(records[0]?.traceId).toBe(traceIdOf(failure));
    expect(records[0]?.outcome).toEqual({
      kind: 'failed',
      error: expect.objectContaining({ code: Code.Internal, rawMessage: 'limits are gone' }),
    });
  });

  it('keeps the first messages of a long upload, with bytes cut to their length', async () => {
    const { records, transport } = recordedServer(router =>
      router.service(FileService, {
        async *echo(requests) {
          for await (const request of requests) {
            if (request.part.case === 'chunk') {
              yield { part: { case: 'chunk', value: request.part.value.subarray(0, 1) } };
            }
          }
        },
      })
    );

    await Array.fromAsync(createClient(FileService, transport).echo(fileOf(10)));

    const record = records[0];
    expect(record?.requestCount).toBe(11);
    expect(record?.responseCount).toBe(10);
    expect(record?.requests).toHaveLength(3);
    expect(record?.requests[0]).toEqual({ header: { name: 'a.bin', size: '1' } });
    expect(JSON.stringify(record?.requests[1])).toMatch(/… \(43692 chars\)/);
  });
});
