export type TransportProtocol = 'http3' | 'websocket';

/** `auto` lets the transport choose; the others force one protocol. */
export type TransportMode = 'auto' | TransportProtocol;

/** `binary` is protobuf; `json` keeps every call that moves no bytes readable on the wire, for debugging. */
export type WireFormat = 'binary' | 'json';

export type ConnectionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'open'; readonly protocol: TransportProtocol }
  | { readonly kind: 'failed'; readonly reason: string };
