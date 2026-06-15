/**
 * Read a persisted id from `storage`, generating + writing a fresh one on
 * first use (or when the stored value is malformed). Falls back to an
 * ephemeral id when storage throws (private-mode Safari, hardened profiles)
 * so callers still get a working — if non-persistent — id.
 */
export function getOrCreatePersistentId<TId>(params: {
  readonly key: string;
  readonly generate: () => TId;
  /** Parse a stored raw string into an id, or `null` if malformed/missing. */
  readonly parse: (raw: string) => TId | null;
  readonly serialize: (id: TId) => string;
  readonly storage?: Storage;
}): TId {
  const storage = params.storage ?? localStorage;
  try {
    const raw = storage.getItem(params.key);
    if (raw !== null) {
      const existing = params.parse(raw);
      if (existing !== null) {
        return existing;
      }
    }
    const next = params.generate();
    storage.setItem(params.key, params.serialize(next));
    return next;
  } catch {
    return params.generate();
  }
}
