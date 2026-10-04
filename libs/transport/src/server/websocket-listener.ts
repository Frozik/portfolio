import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import type { RawData, WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import type { IMessageSocket } from '../mux/message-socket';
import { SOCKET_CLOSE_PROTOCOL_ERROR } from '../mux/message-socket';
import { MUX_PROTOCOL_LIMITS, muxSessionOptions } from '../mux/mux-limits';
import { MUX_HEADER_BYTES } from '../mux/mux-message';
import { createMuxSession } from '../mux/mux-session';
import type { ITransportSession } from '../shared/session';
import type { SessionRequest } from './peer';

export interface WebSocketListenerOptions {
  /** The HTTP(S) server already listening on the TCP port; the fallback shares it. */
  readonly server: Server;
  readonly path: string;
  readonly maxStreamsPerSession: number;
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
  });
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(request.url ?? '/', 'http://upgrade').pathname !== options.path) {
      return;
    }
    const ip = request.socket.remoteAddress ?? '';
    if (!options.admit({ ip, origin: request.headers.origin })) {
      socket.end(FORBIDDEN_RESPONSE);
      return;
    }
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

class NodeMessageSocket implements IMessageSocket {
  readonly opened = Promise.resolve();
  readonly closed: Promise<void>;

  constructor(private readonly socket: WebSocket) {
    this.closed = new Promise(resolve => {
      socket.once('close', () => resolve());
    });
  }

  get bufferedAmount(): number {
    return this.socket.bufferedAmount;
  }

  send(message: Uint8Array<ArrayBuffer>): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(message);
    }
  }

  close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }

  onMessage(listener: (message: Uint8Array) => void): void {
    this.socket.on('message', (data: RawData, isBinary: boolean) => {
      if (!isBinary || !(data instanceof Uint8Array)) {
        this.close(SOCKET_CLOSE_PROTOCOL_ERROR, 'binary messages only');
        return;
      }
      // An exception here would escape into the ws event loop and take the
      // whole process down, so a client can never do more than lose its socket.
      try {
        listener(data);
      } catch (error) {
        this.close(
          SOCKET_CLOSE_PROTOCOL_ERROR,
          error instanceof Error ? error.message : 'protocol error'
        );
      }
    });
  }
}
