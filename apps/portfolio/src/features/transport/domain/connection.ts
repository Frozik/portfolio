export type TransportProtocol = 'http3' | 'websocket';

/** `auto` lets the transport choose; the others force one protocol. */
export type TransportMode = 'auto' | TransportProtocol;

export type ConnectionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'open'; readonly protocol: TransportProtocol }
  | { readonly kind: 'failed'; readonly reason: string };
