export interface IClock {
  /** Milliseconds from an arbitrary origin; only differences mean anything. */
  now(): number;
  /** Calls back every `ms` until the returned function is called. */
  every(ms: number, callback: () => void): () => void;
}
