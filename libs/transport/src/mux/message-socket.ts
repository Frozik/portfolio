/** A message-oriented duplex (a WebSocket, in practice) the multiplexer runs over. */
export interface IMessageSocket {
  readonly opened: Promise<void>;
  readonly closed: Promise<void>;
  /** Bytes accepted by `send` but not yet handed to the network. */
  readonly bufferedAmount: number;
  /** A string goes out as a text message, bytes as a binary one. */
  send(message: Uint8Array<ArrayBuffer> | string): void;
  close(code: number, reason: string): void;
  onMessage(listener: (message: Uint8Array | string) => void): void;
}

export const SOCKET_CLOSE_NORMAL = 1000;
// Browsers only let a page close a WebSocket with 1000 or 3000–4999, so the protocol error lives in the application range.
export const SOCKET_CLOSE_PROTOCOL_ERROR = 4002;
