/**
 * The slice of a Yjs awareness instance the room needs: publishing the local
 * participant and reading everyone else's. Mirrors `y-protocols/awareness`
 * so the infrastructure hands the real instance over unchanged, while tests
 * substitute a plain in-memory fake.
 */
export interface IRoomAwareness {
  on(event: 'change', listener: () => void): void;
  off(event: 'change', listener: () => void): void;
  setLocalState(state: null): void;
  setLocalStateField(field: string, value: unknown): void;
  getStates(): ReadonlyMap<number, Readonly<Record<string, unknown>>>;
  readonly meta: ReadonlyMap<number, { readonly lastUpdated: number }>;
}
