import type { IMessageSocket } from '../mux/message-socket';

/** Two linked sockets; a message reaches the peer on a later macrotask, like a network hop. */
export function createMemorySocketPair(): readonly [IMessageSocket, IMessageSocket] {
  const left = new MemorySocket();
  const right = new MemorySocket();
  left.link(right);
  right.link(left);
  return [left, right];
}

class MemorySocket implements IMessageSocket {
  readonly opened = Promise.resolve();
  readonly closed: Promise<void>;
  bufferedAmount = 0;

  private peer: MemorySocket | undefined;
  private listener: ((message: Uint8Array | string) => void) | undefined;
  private isClosed = false;
  private readonly closing = Promise.withResolvers<void>();

  constructor() {
    this.closed = this.closing.promise;
  }

  link(peer: MemorySocket): void {
    this.peer = peer;
  }

  send(message: Uint8Array<ArrayBuffer> | string): void {
    if (this.isClosed) {
      return;
    }
    const copy = typeof message === 'string' ? message : message.slice();
    const size = typeof copy === 'string' ? copy.length : copy.byteLength;
    this.bufferedAmount += size;
    setTimeout(() => {
      this.bufferedAmount -= size;
      this.peer?.deliver(copy);
    }, 0);
  }

  close(): void {
    this.shut();
    this.peer?.shut();
  }

  onMessage(listener: (message: Uint8Array | string) => void): void {
    this.listener = listener;
  }

  private deliver(message: Uint8Array | string): void {
    if (!this.isClosed) {
      this.listener?.(message);
    }
  }

  private shut(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.closing.resolve();
  }
}
