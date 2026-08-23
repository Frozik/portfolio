import { isNil } from 'lodash-es';

const MUTED_VALUE = 'true';
const UNMUTED_VALUE = 'false';
/** A first visit — or anything unreadable — plays with sound on. */
const DEFAULT_IS_MUTED = false;

export interface IMutedStorage {
  read(): boolean;
  write(isMuted: boolean): void;
}

/**
 * Mute persistence, keyed per game so two features on the same origin never share a preference.
 * Every failure degrades to the default instead of propagating: web storage throws in hardened
 * profiles and private-mode Safari, and a silenced game is never worth taking the page down for.
 */
export function createMutedStorage(
  storageKey: string,
  storage: Storage = localStorage
): IMutedStorage {
  return {
    read(): boolean {
      try {
        const raw = storage.getItem(storageKey);

        return isNil(raw) ? DEFAULT_IS_MUTED : raw === MUTED_VALUE;
      } catch {
        return DEFAULT_IS_MUTED;
      }
    },

    write(isMuted: boolean): void {
      try {
        storage.setItem(storageKey, isMuted ? MUTED_VALUE : UNMUTED_VALUE);
      } catch {
        // A preference that cannot be stored is not worth interrupting the game for.
      }
    },
  };
}
