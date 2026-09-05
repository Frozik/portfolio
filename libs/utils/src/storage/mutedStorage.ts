import type { IValueCodec, IValueStorage } from './valueStorage';
import { createValueStorage } from './valueStorage';

const IS_MUTED_BY_STORED_VALUE: Readonly<Record<string, boolean | undefined>> = {
  true: true,
  false: false,
};

/** A first visit — or anything unreadable — plays with sound on. */
const MUTED_CODEC: IValueCodec<boolean> = {
  fallback: false,
  parse: raw => IS_MUTED_BY_STORED_VALUE[raw],
  serialize: String,
};

export type IMutedStorage = IValueStorage<boolean>;

/** Mute persistence, keyed per game so two features on the same origin never share a preference. */
export function createMutedStorage(
  storageKey: string,
  storage: Storage = localStorage
): IMutedStorage {
  return createValueStorage(storageKey, MUTED_CODEC, storage);
}
