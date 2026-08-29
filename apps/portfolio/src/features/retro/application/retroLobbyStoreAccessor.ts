import type { RootStore } from '../../../app/stores/RootStore';
import { createRoomIndexRepo } from '../infrastructure/room-index-repo';
import { RetroLobbyStore } from './RetroLobbyStore';
import { getUserDirectoryStore } from './userDirectoryStoreAccessor';

/**
 * Single feature-store key for the retro lobby. The lobby page and every
 * room store resolve the SAME `RetroLobbyStore` through this key, so the
 * recent-rooms index a room writes into is the one the lobby renders.
 */
export const RETRO_LOBBY_STORE_KEY = 'retro-lobby';

/**
 * Acquire the shared `RetroLobbyStore`, creating it on first use and
 * memoising it on the root store. Like the user directory it is not
 * refcounted — it stays alive for the root store's lifetime.
 */
export function getRetroLobbyStore(rootStore: RootStore): RetroLobbyStore {
  return rootStore.getOrCreateFeatureStore(
    RETRO_LOBBY_STORE_KEY,
    () => new RetroLobbyStore(createRoomIndexRepo(), getUserDirectoryStore(rootStore))
  );
}
