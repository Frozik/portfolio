import { useRootStore } from '../../../app/stores/StoreContext';
import { createRoomIndexRepo } from '../infrastructure/room-index-repo';
import { RetroLobbyStore } from './RetroLobbyStore';
import { getUserDirectoryStore } from './userDirectoryStoreAccessor';

const RETRO_LOBBY_KEY = 'retro-lobby';

export function useRetroLobbyStore(): RetroLobbyStore {
  const rootStore = useRootStore();
  const directory = getUserDirectoryStore(rootStore);
  return rootStore.getOrCreateFeatureStore(
    RETRO_LOBBY_KEY,
    () => new RetroLobbyStore(createRoomIndexRepo(), directory)
  );
}
