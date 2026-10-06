import type { ConnectionState, TransportMode, WireFormat } from '../connection';

/** The shared transport as the page sees it: its state, which protocol it may use and how it encodes. */
export interface ITransportLink {
  readonly state: ConnectionState;
  subscribe(listener: (state: ConnectionState) => void): () => void;
  setMode(mode: TransportMode): void;
  readonly wireFormat: WireFormat;
  setWireFormat(format: WireFormat): void;
  dispose(): void;
}
