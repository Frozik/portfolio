import type { RawData, WebSocket } from 'ws';

import type { IMessageSocket } from '../mux/message-socket';
import { SOCKET_CLOSE_PROTOCOL_ERROR } from '../mux/message-socket';

/** A `ws` socket, accepted or dialled, as the multiplexer's message socket. */
export class NodeMessageSocket implements IMessageSocket {
  readonly opened: Promise<void>;
  readonly closed: Promise<void>;

  constructor(private readonly socket: WebSocket) {
    this.opened =
      socket.readyState === socket.OPEN
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
            socket.once('open', () => resolve());
            socket.once('error', reject);
          });
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
