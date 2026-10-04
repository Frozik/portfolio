import type { Server } from 'node:http';

import { createContextValues } from '@connectrpc/connect';
import type { UniversalHandler } from '@connectrpc/connect/protocol';

import type { PinnedCertificateBody } from '../shared/pinned-certificate';
import { encodePinnedCertificate } from '../shared/pinned-certificate';
import type { ITransportSession, TransportProtocol } from '../shared/session';
import { serveConnectSession } from '../tunnel/serve-connect-session';
import type { Http3Listener, TransportCertificate } from './http3-listener';
import { startHttp3Listener } from './http3-listener';
import type { SessionRequest } from './peer';
import { TRANSPORT_CLIENT_ADDRESS, TRANSPORT_PROTOCOL } from './peer';
import type { SessionAdmissionOptions } from './session-admission';
import { createSessionAdmission } from './session-admission';
import type { WebSocketListener } from './websocket-listener';
import { startWebSocketListener } from './websocket-listener';

export interface TransportServerOptions {
  readonly handlers: readonly UniversalHandler[];
  /** The same path serves both protocols: `https://host/<path>` over UDP and `wss://host/<path>` over TCP. */
  readonly path: string;
  readonly http3: { readonly host: string; readonly port: number };
  /**
   * The public certificate, or `'self-signed'` for development: a 13-day
   * certificate made at start, which browsers pin by hash (see `pinnedCertificate`).
   */
  readonly certificate: TransportCertificate | 'self-signed';
  readonly websocket: { readonly server: Server };
  readonly limits: {
    readonly maxSessions: number;
    readonly maxStreamsPerSession: number;
    /** A stream with no bytes moving either way for this long is reset. */
    readonly streamIdleTimeoutMs: number;
    readonly streamWindowBytes: number;
    readonly sessionWindowBytes: number;
  };
  readonly admission: Omit<SessionAdmissionOptions, 'now'>;
  readonly onSessionChange?: (change: SessionChange) => void;
  readonly onError: (error: unknown) => void;
}

export interface SessionChange {
  readonly protocol: TransportProtocol;
  readonly delta: 1 | -1;
}

export interface TransportServer {
  readonly http3Port: number;
  /** What the development route answers; undefined with a public certificate. */
  readonly pinnedCertificate: PinnedCertificateBody | undefined;
  reloadCertificate(certificate: TransportCertificate): Promise<void>;
  /** Refuses new sessions and closes the live ones. */
  close(): Promise<void>;
}

/** Serves Connect handlers to browsers over HTTP/3 and over the WebSocket fallback alike. */
export async function startTransportServer(
  options: TransportServerOptions
): Promise<TransportServer> {
  const live = new Set<ITransportSession>();
  let isClosing = false;
  const admission = createSessionAdmission({ ...options.admission, now: () => performance.now() });
  const { certificate, pinnedSha256 } = await resolveCertificate(options.certificate);

  const admitFor = (protocol: TransportProtocol) => (request: SessionRequest) =>
    !isClosing && live.size < options.limits.maxSessions && admission.admit(request, protocol);

  const serveFor = (protocol: TransportProtocol) => (session: ITransportSession, ip: string) => {
    live.add(session);
    admission.opened(ip, protocol);
    options.onSessionChange?.({ protocol, delta: 1 });
    const forget = () => {
      if (live.delete(session)) {
        admission.closed(ip, protocol);
        options.onSessionChange?.({ protocol, delta: -1 });
      }
    };
    session.closed.then(forget, forget);
    const clientAddress = admission.clientAddress(ip, protocol);
    void serveConnectSession(session, {
      handlers: options.handlers,
      maxStreams: options.limits.maxStreamsPerSession,
      streamIdleTimeoutMs: options.limits.streamIdleTimeoutMs,
      contextValues: () =>
        createContextValues()
          .set(TRANSPORT_CLIENT_ADDRESS, clientAddress)
          .set(TRANSPORT_PROTOCOL, protocol),
      onStreamError: options.onError,
    });
  };

  const http3: Http3Listener = await startHttp3Listener({
    ...options.http3,
    certificate,
    path: options.path,
    streamWindowBytes: options.limits.streamWindowBytes,
    sessionWindowBytes: options.limits.sessionWindowBytes,
    admit: admitFor('http3'),
    onSession: serveFor('http3'),
    onError: options.onError,
  });
  const websocket: WebSocketListener = startWebSocketListener({
    server: options.websocket.server,
    path: options.path,
    maxStreamsPerSession: options.limits.maxStreamsPerSession,
    admit: admitFor('websocket'),
    onSession: serveFor('websocket'),
  });
  const pinnedCertificate =
    pinnedSha256 === undefined
      ? undefined
      : encodePinnedCertificate({ sha256: pinnedSha256, http3Port: http3.port });

  return {
    get http3Port() {
      return http3.port;
    },
    pinnedCertificate,
    reloadCertificate: next => http3.reloadCertificate(next),
    async close() {
      isClosing = true;
      websocket.close();
      for (const session of live) {
        session.close();
      }
      await http3.close();
    },
  };
}

async function resolveCertificate(source: TransportCertificate | 'self-signed'): Promise<{
  readonly certificate: TransportCertificate;
  readonly pinnedSha256: Uint8Array<ArrayBuffer> | undefined;
}> {
  if (source !== 'self-signed') {
    return { certificate: source, pinnedSha256: undefined };
  }
  const { createSelfSignedCertificate } = await import('./self-signed-certificate');
  const selfSigned = await createSelfSignedCertificate();
  return { certificate: selfSigned, pinnedSha256: selfSigned.sha256 };
}
