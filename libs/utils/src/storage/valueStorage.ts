import { isNil } from 'lodash-es';

export interface IValueStorage<T> {
  read(): T;
  write(value: T): void;
}

export interface IValueCodec<T> {
  /** What `read` answers on a first visit, for an unreadable entry, and without web storage. */
  readonly fallback: T;
  /** `undefined` rejects an entry in a shape this codec never writes (another tab, an old build). */
  readonly parse: (raw: string) => T | undefined;
  readonly serialize: (value: T) => string;
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const PROBE_KEY = '__value-storage-probe__';

/** Hardened profiles and private-mode Safari throw on any access — probed once, never per call. */
function isWebStorageUsable(storage: Storage): boolean {
  try {
    storage.setItem(PROBE_KEY, PROBE_KEY);
    storage.removeItem(PROBE_KEY);

    return true;
  } catch {
    return false;
  }
}

function createMemoryStore(): KeyValueStore {
  const entries = new Map<string, string>();

  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/**
 * One typed value under one key of web storage. Where web storage is unusable the value lives in
 * memory for the session instead, so callers never see an exception and never branch on
 * availability — a preference that cannot outlive the tab is still a preference.
 */
export function createValueStorage<T>(
  storageKey: string,
  codec: IValueCodec<T>,
  storage: Storage = localStorage
): IValueStorage<T> {
  const store: KeyValueStore = isWebStorageUsable(storage) ? storage : createMemoryStore();

  return {
    read(): T {
      const raw = store.getItem(storageKey);

      return isNil(raw) ? codec.fallback : (codec.parse(raw) ?? codec.fallback);
    },

    write(value: T): void {
      store.setItem(storageKey, codec.serialize(value));
    },
  };
}
