import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocketServer } from 'ws';

import { MUX_PROTOCOL_LIMITS, MUX_SUBPROTOCOL, muxSessionOptions } from '../mux/mux-limits';
import { MUX_HEADER_BYTES } from '../mux/mux-message';
import { createMuxSession } from '../mux/mux-session';
import type { ITransportSession } from '../shared/session';
import { NodeMessageSocket } from './node-message-socket';
import type { SessionRequest } from './peer';

export interface WebSocketListenerOptions {
  /** The HTTP(S) server already listening on the TCP port; the fallback shares it. */
  readonly server: Server;
  readonly path: string;
  readonly maxStreamsPerSession: number;
  /** Who is asking: the browser itself, or the browser behind the gateway. Undefined refuses. */
  readonly identify: (request: IncomingMessage) => SessionRequest | undefined;
  readonly admit: (request: SessionRequest) => boolean;
  readonly onSession: (session: ITransportSession, ip: string) => void;
}

export interface WebSocketListener {
  close(): void;
}

const FORBIDDEN_RESPONSE = 'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n';

export function startWebSocketListener(options: WebSocketListenerOptions): WebSocketListener {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MUX_HEADER_BYTES + MUX_PROTOCOL_LIMITS.maxDataBytes,
    // Bundles from before the subprotocol name none; they speak the same v1.
    handleProtocols: protocols => (protocols.has(MUX_SUBPROTOCOL) ? MUX_SUBPROTOCOL : false),
  });
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(request.url ?? '/', 'http://upgrade').pathname !== options.path) {
      return;
    }
    const identity = options.identify(request);
    if (identity === undefined || !options.admit(identity)) {
      socket.end(FORBIDDEN_RESPONSE);
      return;
    }
    const ip = identity.ip;
    sockets.handleUpgrade(request, socket, head, webSocket => {
      options.onSession(
        createMuxSession(
          new NodeMessageSocket(webSocket),
          muxSessionOptions('server', options.maxStreamsPerSession)
        ),
        ip
      );
    });
  };
  options.server.on('upgrade', onUpgrade);
  return {
    close() {
      options.server.off('upgrade', onUpgrade);
      for (const client of sockets.clients) {
        client.terminate();
      }
      sockets.close();
    },
  };
}
