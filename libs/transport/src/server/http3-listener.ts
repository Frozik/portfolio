import { randomBytes } from 'node:crypto';

import { Http3Server } from '@fails-components/webtransport';

import type { ITransportSession } from '../shared/session';
import type { SessionRequest } from './peer';
import { ipOf } from './peer';

export interface TransportCertificate {
  readonly cert: string;
  readonly key: string;
}

export interface Http3ListenerOptions {
  readonly host: string;
  readonly port: number;
  readonly path: string;
  readonly certificate: TransportCertificate;
  /** Per-stream receive window: the most a stream can hold that its handler has not read yet. */
  readonly streamWindowBytes: number;
  readonly sessionWindowBytes: number;
  readonly admit: (request: SessionRequest) => boolean;
  readonly onSession: (session: ITransportSession, ip: string) => void;
  readonly onError: (error: unknown) => void;
}

export interface Http3Listener {
  readonly port: number;
  reloadCertificate(certificate: TransportCertificate): Promise<void>;
  close(): Promise<void>;
}

const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const SECRET_BYTES = 32;

/**
 * Per-address quotas lean on the client address. fails-components hands it to
 * the request callback only with our patch; without it every client would
 * share one quota, so a missing address refuses the session instead.
 */
const MISSING_PEER_ADDRESS =
  'HTTP/3 peer address is missing: is patches/@fails-components__webtransport applied?';

/**
 * HTTP/3 WebTransport over fails-components (patched for backpressure, see
 * `patches/`). Its `updateCert` does not reach the QUIC stack, so a new
 * certificate means a new server on the same port; live sessions reconnect.
 */
export async function startHttp3Listener(options: Http3ListenerOptions): Promise<Http3Listener> {
  let server = await startServer(options, options.certificate);
  let lifecycle = Promise.resolve();
  const serially = (step: () => Promise<void>): Promise<void> => {
    lifecycle = lifecycle.then(step, step);
    return lifecycle;
  };
  return {
    get port() {
      return options.port === 0 ? (server.address()?.port ?? 0) : options.port;
    },
    reloadCertificate: certificate =>
      serially(async () => {
        await stopServer(server);
        server = await startServer(options, certificate);
      }),
    close: () => serially(() => stopServer(server)),
  };
}

async function startServer(
  options: Http3ListenerOptions,
  certificate: TransportCertificate
): Promise<Http3Server> {
  const server = new Http3Server({
    host: options.host,
    port: options.port,
    secret: randomBytes(SECRET_BYTES).toString('hex'),
    cert: certificate.cert,
    privKey: certificate.key,
    initialStreamFlowControlWindow: options.streamWindowBytes,
    streamFlowControlWindowSizeLimit: options.streamWindowBytes,
    streamShouldAutoTuneReceiveWindow: false,
    initialSessionFlowControlWindow: options.sessionWindowBytes,
    sessionFlowControlWindowSizeLimit: options.sessionWindowBytes,
    sessionShouldAutoTuneReceiveWindow: false,
    defaultDatagramsReadableMode: 'bytes',
  });
  server.setRequestCallback(
    async ({ header, peerAddress }: { header: Record<string, unknown>; peerAddress?: unknown }) => {
      const path = typeof header[':path'] === 'string' ? header[':path'] : '';
      if (path !== options.path) {
        return { status: HTTP_NOT_FOUND, path };
      }
      if (typeof peerAddress !== 'string') {
        options.onError(new Error(MISSING_PEER_ADDRESS));
        return { status: HTTP_FORBIDDEN, path };
      }
      const origin = typeof header.origin === 'string' ? header.origin : undefined;
      return {
        status: options.admit({ ip: ipOf(peerAddress), origin }) ? HTTP_OK : HTTP_FORBIDDEN,
        path,
      };
    }
  );
  server.startServer();
  await server.ready;
  void acceptSessions(server, options);
  return server;
}

async function acceptSessions(server: Http3Server, options: Http3ListenerOptions): Promise<void> {
  const sessions = server.sessionStream(options.path).getReader();
  try {
    for (;;) {
      const { value: session, done } = await sessions.read();
      if (done) {
        return;
      }
      if (!('peerAddress' in session) || typeof session.peerAddress !== 'string') {
        options.onError(new Error(MISSING_PEER_ADDRESS));
        session.close();
        continue;
      }
      options.onSession(
        {
          ready: session.ready,
          closed: session.closed,
          incomingBidirectionalStreams: session.incomingBidirectionalStreams,
          createBidirectionalStream: () => session.createBidirectionalStream(),
          close: () => session.close(),
        },
        ipOf(session.peerAddress)
      );
    }
  } catch (error) {
    options.onError(error);
  }
}

async function stopServer(server: Http3Server): Promise<void> {
  server.stopServer();
  await server.closed;
}
