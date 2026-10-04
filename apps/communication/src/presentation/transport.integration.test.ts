import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { quicheLoaded, WebTransport } from '@fails-components/webtransport';
import type { EchoRequest } from '@frozik/proto/frozik/transport/v1/file_pb';
import { EchoRequestSchema, FileService } from '@frozik/proto/frozik/transport/v1/file_pb';
import { ExpressionErrorSchema, PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';
import { openWebSocketSession } from '@frozik/transport/client/browser-websocket';
import { createSessionTransport } from '@frozik/transport/client/session-transport';
import { testClientOptions } from '@frozik/transport/server/test-server';
import { decodePinnedCertificate } from '@frozik/transport/shared/pinned-certificate';
import type { ITransportSession } from '@frozik/transport/shared/session';
import { Crc32 } from '@frozik/utils/hash/crc32';
import { afterEach, describe, expect, it } from 'vitest';

import type { IServerConfig } from '../application/config/server-config-schema';
import type { BootstrapResult } from './bootstrap';
import { bootstrap } from './bootstrap';
import { buildTestConfig } from './testing/test-server-config';

const CHUNK_BYTES = 64 * 1024;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const TEST_TIMEOUT_MS = 20_000;
const STREAM_WINDOW_BYTES = 262_144;
const STALL_WAIT_MS = 300;
/** A loaded machine needs a few rounds to stall; a sender that never stalls fails after these. */
const MAX_SETTLE_ROUNDS = 10;
/** Messages in flight between a generator and the wire: Connect, the frame writer, the stream queues. */
const IN_FLIGHT_MESSAGES = 16;

interface Running {
  readonly app: BootstrapResult;
  readonly publicPort: number;
}

function transportConfig(): IServerConfig {
  return buildTestConfig({
    transport: {
      enabled: true,
      path: '/transport',
      http3_host: '127.0.0.1',
      http3_port: 0,
      max_sessions: 16,
      max_sessions_per_ip: 16,
      max_streams_per_session: 8,
      stream_idle_timeout_ms: 1_000,
      stream_window_bytes: STREAM_WINDOW_BYTES,
      session_window_bytes: 1_048_576,
      expression_max_length: 200,
      expression_max_depth: 48,
      sample_max_points: 5_000,
      sample_chunk_points: 1_000,
      echo: {
        max_file_bytes: MAX_FILE_BYTES,
        bytes_per_ip_per_hour: 3 * MAX_FILE_BYTES,
        concurrent_per_ip: 2,
        concurrent_total: 4,
        rate_bytes_per_second: 100_000_000,
      },
    },
  });
}

async function start(): Promise<Running> {
  const app = await bootstrap(transportConfig());
  const { publicPort } = await app.start();
  return { app, publicPort };
}

async function http3Session(running: Running): Promise<ITransportSession> {
  const response = await fetch(
    `http://127.0.0.1:${running.publicPort}/transport/pinned-certificate`
  );
  const { sha256, http3Port } = decodePinnedCertificate(await response.json());
  await quicheLoaded;
  const transport = new WebTransport(
    `https://127.0.0.1:${http3Port}/transport`,
    testClientOptions(sha256, STREAM_WINDOW_BYTES)
  );
  await transport.ready;
  return {
    ready: transport.ready,
    closed: transport.closed,
    incomingBidirectionalStreams: transport.incomingBidirectionalStreams,
    createBidirectionalStream: () => transport.createBidirectionalStream(),
    close: () => transport.close(),
  };
}

function websocketSession(running: Running): Promise<ITransportSession> {
  const session = openWebSocketSession(`ws://127.0.0.1:${running.publicPort}/transport`);
  return session.ready.then(() => session);
}

function clientsOver(session: ITransportSession) {
  const transport = createSessionTransport({
    openStream: () => session.createBidirectionalStream(),
    baseUrl: 'https://127.0.0.1',
    readMaxBytes: 4 * 1024 * 1024,
  });
  return { plot: createClient(PlotService, transport), file: createClient(FileService, transport) };
}

async function* fileOf(size: number, declared = size): AsyncGenerator<EchoRequest> {
  yield create(EchoRequestSchema, {
    part: { case: 'header', value: { name: 'test.bin', size: BigInt(declared) } },
  });
  for (let offset = 0; offset < size; offset += CHUNK_BYTES) {
    const chunk = new Uint8Array(Math.min(CHUNK_BYTES, size - offset));
    chunk.forEach((_, index) => {
      chunk[index] = (offset + index) % 251;
    });
    yield create(EchoRequestSchema, { part: { case: 'chunk', value: chunk } });
  }
}

function expectedCrc(size: number): number {
  const crc = new Crc32();
  const all = new Uint8Array(size);
  all.forEach((_, index) => {
    all[index] = index % 251;
  });
  crc.update(all);
  return crc.value;
}

describe('transport endpoint', () => {
  let running: Running | undefined;

  afterEach(async () => {
    await running?.app.close();
    running = undefined;
  });

  it(
    'samples a plot over HTTP/3 and reports a parse error with its position',
    async () => {
      running = await start();
      const { plot } = clientsOver(await http3Session(running));

      const chunks = await Array.fromAsync(
        plot.sample({ expression: 'x^2 + 2x + 3', xMin: -1, xMax: 1, points: 2_001 })
      );
      expect(chunks).toHaveLength(3);
      expect(chunks[0]?.y[0]).toBe(2);
      expect(chunks.at(-1)?.y.at(-1)).toBe(6);

      const failure = await Array.fromAsync(
        plot.sample({ expression: 'x + * 2', xMin: 0, xMax: 1, points: 10 })
      ).then(
        () => undefined,
        (error: unknown) => ConnectError.from(error)
      );
      expect(failure?.code).toBe(Code.InvalidArgument);
      expect(failure?.findDetails(ExpressionErrorSchema)[0]?.position).toBe(4);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'echoes a file back byte for byte with a matching checksum',
    async () => {
      running = await start();
      const { file } = clientsOver(await http3Session(running));
      const size = 3 * 1024 * 1024 + 17;

      let received = 0;
      const crc = new Crc32();
      let summaryCrc: number | undefined;
      for await (const response of file.echo(fileOf(size))) {
        if (response.part.case === 'chunk') {
          received += response.part.value.byteLength;
          crc.update(response.part.value);
        } else if (response.part.case === 'summary') {
          summaryCrc = response.part.value.crc32;
        }
      }

      expect(received).toBe(size);
      expect(crc.value).toBe(expectedCrc(size));
      expect(summaryCrc).toBe(crc.value);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'refuses files over the limit and streams that send more than they declared',
    async () => {
      running = await start();
      const { file } = clientsOver(await http3Session(running));

      const oversize = await Array.fromAsync(file.echo(fileOf(1, MAX_FILE_BYTES + 1))).then(
        () => undefined,
        (error: unknown) => ConnectError.from(error).code
      );
      const overflowing = await Array.fromAsync(file.echo(fileOf(CHUNK_BYTES * 2, 10))).then(
        () => undefined,
        (error: unknown) => ConnectError.from(error).code
      );

      expect(oversize).toBe(Code.InvalidArgument);
      expect(overflowing).toBe(Code.InvalidArgument);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'serves the same services over the WebSocket fallback',
    async () => {
      running = await start();
      const { plot } = clientsOver(await websocketSession(running));

      const limits = await plot.getPlotLimits({});

      expect(limits.sampleMaxPoints).toBe(5_000);
    },
    TEST_TIMEOUT_MS
  );

  it.each([
    ['HTTP/3', http3Session],
    ['the WebSocket fallback', websocketSession],
  ] as const)(
    'holds a client that never reads the echo to two windows over %s, not the whole file',
    async (_, open) => {
      running = await start();
      const { file } = clientsOver(await open(running));
      let sent = 0;
      async function* counted(): AsyncGenerator<EchoRequest> {
        for await (const request of fileOf(MAX_FILE_BYTES)) {
          if (request.part.case === 'chunk') {
            sent += request.part.value.byteLength;
          }
          yield request;
        }
      }
      const controller = new AbortController();

      const responses = file.echo(counted(), { signal: controller.signal });

      void responses[Symbol.asyncIterator]()
        .next()
        .catch(() => undefined);
      let previous = -1;
      for (let round = 0; round < MAX_SETTLE_ROUNDS && sent !== previous; round += 1) {
        previous = sent;
        await new Promise(resolve => setTimeout(resolve, STALL_WAIT_MS));
      }

      expect(sent).toBe(previous);
      expect(sent).toBeLessThan(STREAM_WINDOW_BYTES * 2 + IN_FLIGHT_MESSAGES * CHUNK_BYTES);
      controller.abort();
    },
    TEST_TIMEOUT_MS
  );
});
