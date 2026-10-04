import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ConnectRouter, Transport } from '@connectrpc/connect';
import { createConnectRouter } from '@connectrpc/connect';
import { quicheLoaded, WebTransport } from '@fails-components/webtransport';

import { openWebSocketSession } from '../client/browser-websocket';
import { createSessionTransport } from '../client/session-transport';
import { settleTeardown } from '../frame/settle';
import { decodePinnedCertificate } from '../shared/pinned-certificate';
import type { ITransportSession, TransportProtocol } from '../shared/session';
import type { SelfSignedCertificate } from './self-signed-certificate';
import type { TransportServer } from './start-transport-server';
import { startTransportServer } from './start-transport-server';

const PATH = '/transport';
const TEST_STREAM_WINDOW_BYTES = 256 * 1024;
const READ_MAX_BYTES = 1024 * 1024;

export interface TestServer {
  readonly server: TransportServer;
  readonly http: Server;
  readonly sha256: Uint8Array<ArrayBuffer>;
  /** The HTTP/3 stream receive window the server was started with. */
  readonly streamWindowBytes: number;
}

export interface TestServerOptions {
  readonly register: (router: ConnectRouter) => void;
  readonly certificate?: SelfSignedCertificate | 'self-signed';
  readonly maxSessionsPerIp?: number;
  readonly behindProxy?: readonly TransportProtocol[];
}

/** A transport server on loopback ports picked by the OS: HTTP/3 and the WebSocket fallback. */
export async function startTestServer({
  register,
  certificate = 'self-signed',
  maxSessionsPerIp = 8,
  behindProxy = [],
}: TestServerOptions): Promise<TestServer> {
  const router = createConnectRouter();
  register(router);
  const http = createServer();
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const server = await startTransportServer({
    handlers: router.handlers,
    path: PATH,
    http3: { host: '127.0.0.1', port: 0 },
    certificate,
    websocket: { server: http },
    limits: {
      maxSessions: 8,
      maxStreamsPerSession: 8,
      streamIdleTimeoutMs: 5_000,
      streamWindowBytes: TEST_STREAM_WINDOW_BYTES,
      sessionWindowBytes: TEST_STREAM_WINDOW_BYTES * 4,
    },
    admission: {
      allowedOrigins: ['https://site.example'],
      maxSessionsPerIp,
      attemptsPerIpPerMinute: 100,
      behindProxy,
    },
    onError: () => undefined,
  });
  const sha256 =
    certificate === 'self-signed'
      ? decodePinnedCertificate(server.pinnedCertificate).sha256
      : certificate.sha256;
  return { server, http, sha256, streamWindowBytes: TEST_STREAM_WINDOW_BYTES };
}

export async function stopTestServer({ server, http }: TestServer): Promise<void> {
  await server.close();
  http.closeAllConnections();
  await new Promise(resolve => http.close(resolve));
}

export async function openTestSession(
  running: TestServer,
  protocol: TransportProtocol,
  sha256 = running.sha256
): Promise<ITransportSession> {
  switch (protocol) {
    case 'http3':
      return http3Session(running, sha256);
    case 'websocket':
      return websocketSession(running);
  }
}

type ClientOptions = NonNullable<ConstructorParameters<typeof WebTransport>[1]>;

/**
 * Options for the fails-components client with the given receive windows. It
 * reads them at runtime but types only the DOM options, and left alone it grows
 * a stream window to 6 MiB, which would hide the server's own bound.
 */
export function testClientOptions(
  sha256: Uint8Array<ArrayBuffer>,
  windowBytes: number
): ClientOptions {
  const options: ClientOptions & Record<string, unknown> = {
    serverCertificateHashes: [{ algorithm: 'sha-256', value: sha256 }],
    initialStreamFlowControlWindow: windowBytes,
    streamFlowControlWindowSizeLimit: windowBytes,
    streamShouldAutoTuneReceiveWindow: false,
    initialSessionFlowControlWindow: windowBytes * 4,
    sessionFlowControlWindowSizeLimit: windowBytes * 4,
    sessionShouldAutoTuneReceiveWindow: false,
  };
  return options;
}

export function transportOver(session: ITransportSession): Transport {
  return createSessionTransport({
    openStream: () => session.createBidirectionalStream(),
    baseUrl: 'https://127.0.0.1',
    readMaxBytes: READ_MAX_BYTES,
  });
}

async function http3Session(
  running: TestServer,
  sha256: Uint8Array<ArrayBuffer>
): Promise<ITransportSession> {
  await quicheLoaded;
  const transport = new WebTransport(
    `https://127.0.0.1:${running.server.http3Port}${PATH}`,
    testClientOptions(sha256, running.streamWindowBytes)
  );
  settleTeardown(transport.closed);
  await transport.ready;
  return {
    ready: transport.ready,
    closed: transport.closed,
    incomingBidirectionalStreams: transport.incomingBidirectionalStreams,
    createBidirectionalStream: () => transport.createBidirectionalStream(),
    close: () => transport.close(),
  };
}

async function websocketSession(running: TestServer): Promise<ITransportSession> {
  const { port } = running.http.address() as AddressInfo;
  const session = openWebSocketSession(`ws://127.0.0.1:${port}${PATH}`);
  await session.ready;
  return session;
}
