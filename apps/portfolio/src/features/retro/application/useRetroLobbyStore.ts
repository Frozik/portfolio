import { useRootStore } from '../../../app/stores';
import { createRoomIndexRepo } from '../infrastructure/room-index-repo';
import { createUserDirectoryRepo } from '../infrastructure/user-directory-repo';
import { RetroLobbyStore } from './RetroLobbyStore';
import { UserDirectoryStore } from './UserDirectoryStore';

const RETRO_LOBBY_KEY = 'retro-lobby';
const USER_DIRECTORY_KEY = 'retro-user-directory';

export function useRetroLobbyStore(): RetroLobbyStore {
  const rootStore = useRootStore();
  const directory = rootStore.getOrCreateFeatureStore(
    USER_DIRECTORY_KEY,
    () => new UserDirectoryStore(createUserDirectoryRepo())
  );
  return rootStore.getOrCreateFeatureStore(
    RETRO_LOBBY_KEY,
    () => new RetroLobbyStore(createRoomIndexRepo(), directory)
  );
}
