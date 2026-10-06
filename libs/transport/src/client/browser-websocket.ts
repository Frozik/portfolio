import type { IMessageSocket } from '../mux/message-socket';
import { createMuxSession, muxSessionOptions } from '../mux/mux-session';
import { MUX_WIRES } from '../mux/mux-wire';
import type { ITransportSession } from '../shared/session';
import type { WireFormat } from '../shared/wire-format';

const CLIENT_MAX_INCOMING_STREAMS = 0;

export function openWebSocketSession(url: string, format: WireFormat): ITransportSession {
  const wire = MUX_WIRES[format];
  return createMuxSession(
    new BrowserMessageSocket(url, wire.subprotocol),
    muxSessionOptions('client', CLIENT_MAX_INCOMING_STREAMS, wire)
  );
}

class BrowserMessageSocket implements IMessageSocket {
  readonly opened: Promise<void>;
  readonly closed: Promise<void>;

  private readonly socket: WebSocket;

  constructor(url: string, subprotocol: string) {
    this.socket = new WebSocket(url, subprotocol);
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

  send(message: Uint8Array<ArrayBuffer> | string): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }

  close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }

  onMessage(listener: (message: Uint8Array | string) => void): void {
    this.socket.addEventListener('message', event => {
      if (event.data instanceof ArrayBuffer) {
        listener(new Uint8Array(event.data));
      } else if (typeof event.data === 'string') {
        listener(event.data);
      }
    });
  }
}
