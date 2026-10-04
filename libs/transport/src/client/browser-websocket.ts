import type { IMessageSocket } from '../mux/message-socket';
import { muxSessionOptions } from '../mux/mux-limits';
import { createMuxSession } from '../mux/mux-session';
import type { ITransportSession } from '../shared/session';

const CLIENT_MAX_INCOMING_STREAMS = 0;

export function openWebSocketSession(url: string): ITransportSession {
  return createMuxSession(
    new BrowserMessageSocket(url),
    muxSessionOptions('client', CLIENT_MAX_INCOMING_STREAMS)
  );
}

class BrowserMessageSocket implements IMessageSocket {
  readonly opened: Promise<void>;
  readonly closed: Promise<void>;

  private readonly socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer';
    this.opened = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve(), { once: true });
      this.socket.addEventListener(
        'close',
        () => reject(new Error('WebSocket closed before opening')),
        {
          once: true,
        }
      );
    });
    this.closed = new Promise(resolve => {
      this.socket.addEventListener('close', () => resolve(), { once: true });
    });
  }

  get bufferedAmount(): number {
    return this.socket.bufferedAmount;
  }

  send(message: Uint8Array<ArrayBuffer>): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }

  close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }

  onMessage(listener: (message: Uint8Array) => void): void {
    this.socket.addEventListener('message', event => {
      if (event.data instanceof ArrayBuffer) {
        listener(new Uint8Array(event.data));
      }
    });
  }
}
