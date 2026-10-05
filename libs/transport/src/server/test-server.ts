import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ConnectRouter, Transport } from '@connectrpc/connect';
import { createConnectRouter } from '@connectrpc/connect';
import { WebSocket } from 'ws';

import { openWebSocketSession } from '../client/browser-websocket';
import { createSessionTransport } from '../client/session-transport';
import { MUX_SUBPROTOCOL, muxSessionOptions } from '../mux/mux-limits';
import { createMuxSession } from '../mux/mux-session';
import type { ITransportSession, TransportProtocol } from '../shared/session';
import { GATEWAY_CLIENT_ADDRESS_HEADER } from './gateway-identity';
import { NodeMessageSocket } from './node-message-socket';
import type { TransportServer } from './start-transport-server';
import { startTransportServer } from './start-transport-server';

const PATH = '/transport';
const READ_MAX_BYTES = 1024 * 1024;
const GATEWAY_MAX_INCOMING_STREAMS = 0;

export const TEST_GATEWAY_SECRET = 'test-gateway-secret';
/** What the stand-in gateway forwards as the browser's address unless told otherwise. */
export const TEST_CLIENT_ADDRESS = '203.0.113.7';

export interface TestServer {
  readonly server: TransportServer;
  /** The public server: browsers on the WebSocket fallback. */
  readonly http: Server;
  /** The internal server only the HTTP/3 gateway reaches. */
  readonly gatewayHttp: Server;
}

export interface TestServerOptions {
  readonly register: (router: ConnectRouter) => void;
  readonly maxSessionsPerIp?: number;
  readonly behindProxy?: readonly TransportProtocol[];
}

/** A transport server on loopback ports picked by the OS: the public listener and the gateway's. */
export async function startTestServer({
  register,
  maxSessionsPerIp = 8,
  behindProxy = [],
}: TestServerOptions): Promise<TestServer> {
  const router = createConnectRouter();
  register(router);
  const [http, gatewayHttp] = await Promise.all([listenOnLoopback(), listenOnLoopback()]);
  const server = startTransportServer({
    handlers: router.handlers,
    path: PATH,
    websocket: { server: http },
    gateway: { server: gatewayHttp, secret: TEST_GATEWAY_SECRET },
    limits: { maxSessions: 8, maxStreamsPerSession: 8, streamIdleTimeoutMs: 5_000 },
    admission: {
      allowedOrigins: ['https://site.example'],
      maxSessionsPerIp,
      attemptsPerIpPerMinute: 100,
      behindProxy,
    },
    onError: () => undefined,
  });
  return { server, http, gatewayHttp };
}

export async function stopTestServer({ server, http, gatewayHttp }: TestServer): Promise<void> {
  server.close();
  await Promise.all([closeServer(http), closeServer(gatewayHttp)]);
}

/** `http3` stands for a browser behind the gateway: the session the gateway opens on its behalf. */
export function openTestSession(
  running: TestServer,
  protocol: TransportProtocol
): Promise<ITransportSession> {
  switch (protocol) {
    case 'http3':
      return openGatewaySession(running);
    case 'websocket':
      return websocketSession(running);
  }
}

export interface GatewayHeaders {
  readonly secret?: string;
  readonly clientAddress?: string;
  readonly origin?: string;
  readonly subprotocol?: string;
}

/** Dials like the HTTP/3 gateway does; any field can be changed to play a forger. */
export function openGatewaySession(
  running: TestServer,
  headers: GatewayHeaders = {},
  server: Server = running.gatewayHttp
): Promise<ITransportSession> {
  return dialGateway(`ws://127.0.0.1:${portOf(server)}${PATH}`, headers);
}

/** The session the HTTP/3 gateway opens on a browser's behalf, at any listener URL. */
export async function dialGateway(
  url: string,
  {
    secret = TEST_GATEWAY_SECRET,
    clientAddress = TEST_CLIENT_ADDRESS,
    origin,
    subprotocol = MUX_SUBPROTOCOL,
  }: GatewayHeaders = {}
): Promise<ITransportSession> {
  const socket = new WebSocket(url, subprotocol, {
    headers: {
      authorization: `Bearer ${secret}`,
      [GATEWAY_CLIENT_ADDRESS_HEADER]: clientAddress,
      ...(origin === undefined ? {} : { origin }),
    },
  });
  const session = createMuxSession(
    new NodeMessageSocket(socket),
    muxSessionOptions('client', GATEWAY_MAX_INCOMING_STREAMS)
  );
  await session.ready;
  return session;
}

export function transportOver(session: ITransportSession): Transport {
  return createSessionTransport({
    openStream: () => session.createBidirectionalStream(),
    baseUrl: 'https://127.0.0.1',
    readMaxBytes: READ_MAX_BYTES,
  });
}

async function websocketSession(running: TestServer): Promise<ITransportSession> {
  const session = openWebSocketSession(`ws://127.0.0.1:${portOf(running.http)}${PATH}`);
  await session.ready;
  return session;
}

async function listenOnLoopback(): Promise<Server> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}
