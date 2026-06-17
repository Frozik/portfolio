import type { RootStore } from '../../../app/stores/RootStore';
import { createUserDirectoryRepo } from '../infrastructure/user-directory-repo';
import { UserDirectoryStore } from './UserDirectoryStore';

/**
 * Single feature-store key for the retro user directory. Every consumer
 * (room, identity, lobby, and the directory hook itself) resolves the
 * SAME `UserDirectoryStore` instance off the root store via this key, so
 * a rename performed once propagates everywhere.
 */
export const USER_DIRECTORY_STORE_KEY = 'retro-user-directory';

/**
 * Acquire the shared `UserDirectoryStore`, creating it on first use and
 * memoising it on the root store. Unlike room stores this directory is not
 * refcounted — it is intentionally long-lived for the root store's
 * lifetime so cached profiles survive navigating between lobby and rooms.
 */
export function getUserDirectoryStore(rootStore: RootStore): UserDirectoryStore {
  return rootStore.getOrCreateFeatureStore(
    USER_DIRECTORY_STORE_KEY,
    () => new UserDirectoryStore(createUserDirectoryRepo())
  );
}
