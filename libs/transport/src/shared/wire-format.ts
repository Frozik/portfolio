/**
 * `binary` is the default: protobuf for every method, binary WebSocket
 * messages. `json` is for debugging: JSON for every method whose messages
 * carry no `bytes`, and over the WebSocket text messages that read as they
 * are in DevTools — only raw bytes stay binary.
 */
export type WireFormat = 'binary' | 'json';
