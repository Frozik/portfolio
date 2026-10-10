/** format.md §1 — the only source of randomness in the core, so tests and golden fixtures can fix it. */
export interface IRandom {
  bytes(length: number): Uint8Array<ArrayBuffer>;
}
