import type { ConnectionState, TransportMode } from '../connection';

/** The shared transport as the page sees it: its state, and which protocol it may use. */
export interface ITransportLink {
  readonly state: ConnectionState;
  subscribe(listener: (state: ConnectionState) => void): () => void;
  setMode(mode: TransportMode): void;
  dispose(): void;
}
