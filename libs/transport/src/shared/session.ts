export interface IBidirectionalStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

/**
 * The subset of the WebTransport session API the transport relies on. Native
 * WebTransport and the WebSocket multiplexer both provide it, so everything
 * above is unaware of the wire.
 */
export interface ITransportSession {
  readonly ready: Promise<unknown>;
  readonly closed: Promise<unknown>;
  readonly incomingBidirectionalStreams: ReadableStream<IBidirectionalStream>;
  createBidirectionalStream(): Promise<IBidirectionalStream>;
  close(): void;
}

export type TransportProtocol = 'http3' | 'websocket';
