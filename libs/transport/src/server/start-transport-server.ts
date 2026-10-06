import type { IncomingMessage, Server } from 'node:http';

import { createContextValues } from '@connectrpc/connect';
import type { UniversalHandler } from '@connectrpc/connect/protocol';

import type { ITransportSession, TransportProtocol } from '../shared/session';
import type { TraceContext } from '../shared/trace-context';
import { serveConnectSession } from '../tunnel/serve-connect-session';
import { identifyDirectRequest, identifyGatewayRequest } from './gateway-identity';
import type { SessionRequest } from './peer';
import { TRANSPORT_CLIENT_ADDRESS, TRANSPORT_PROTOCOL } from './peer';
import type { SessionAdmissionOptions } from './session-admission';
import { createSessionAdmission } from './session-admission';
import type { WebSocketListener } from './websocket-listener';
import { startWebSocketListener } from './websocket-listener';

export interface TransportServerOptions {
  readonly handlers: readonly UniversalHandler[];
  /** Browsers reach `wss://host/<path>`, the HTTP/3 gateway `ws://<internal>/<path>`. */
  readonly path: string;
  /** The public HTTP(S) server: browsers on the WebSocket fallback. */
  readonly websocket: { readonly server: Server };
  /**
   * An internal server only the HTTP/3 gateway reaches: one multiplexed
   * session per browser WebTransport session, served as `http3`.
   */
  readonly gateway?: { readonly server: Server; readonly secret: string };
  readonly limits: {
    readonly maxSessions: number;
    readonly maxStreamsPerSession: number;
    /** A stream with no bytes moving either way for this long is reset. */
    readonly streamIdleTimeoutMs: number;
  };
  readonly admission: Omit<SessionAdmissionOptions, 'now'>;
  readonly onSessionChange?: (change: SessionChange) => void;
  /** A call that broke at the transport level; `trace` is its trace once its head arrived. */
  readonly onError: (error: unknown, trace: TraceContext | undefined) => void;
}

export interface SessionChange {
  readonly protocol: TransportProtocol;
  readonly delta: 1 | -1;
}

export interface TransportServer {
  /** Refuses new sessions and closes the live ones. */
  close(): void;
}

/**
 * Serves Connect handlers over multiplexed WebSockets: straight from browsers
 * on the fallback, and from the HTTP/3 gateway for browsers on WebTransport.
 */
export function startTransportServer(options: TransportServerOptions): TransportServer {
  const live = new Set<ITransportSession>();
  let isClosing = false;
  const admission = createSessionAdmission({ ...options.admission, now: () => performance.now() });

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

  const listen = (
    protocol: TransportProtocol,
    server: Server,
    identify: (request: IncomingMessage) => SessionRequest | undefined
  ): WebSocketListener =>
    startWebSocketListener({
      server,
      path: options.path,
      maxStreamsPerSession: options.limits.maxStreamsPerSession,
      identify,
      admit: admitFor(protocol),
      onSession: serveFor(protocol),
    });

  const listeners = [
    listen('websocket', options.websocket.server, identifyDirectRequest),
    ...(options.gateway === undefined
      ? []
      : [listen('http3', options.gateway.server, identifyGatewayRequest(options.gateway.secret))]),
  ];

  return {
    close() {
      isClosing = true;
      for (const listener of listeners) {
        listener.close();
      }
      for (const session of live) {
        session.close();
      }
    },
  };
}
