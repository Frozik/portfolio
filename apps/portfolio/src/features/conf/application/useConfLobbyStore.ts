import { useRootStore } from '../../../app/stores/StoreContext';
import { createConfRoomIndexRepo } from '../infrastructure/conf-room-index-repo';
import { ConfLobbyStore } from './ConfLobbyStore';

const CONF_LOBBY_KEY = 'conf-lobby';

export function useConfLobbyStore(): ConfLobbyStore {
  const rootStore = useRootStore();
  return rootStore.getOrCreateFeatureStore(
    CONF_LOBBY_KEY,
    () => new ConfLobbyStore(createConfRoomIndexRepo())
  );
}
