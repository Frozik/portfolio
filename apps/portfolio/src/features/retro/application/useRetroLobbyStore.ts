import { useRootStore } from '../../../app/stores/StoreContext';
import type { RetroLobbyStore } from './RetroLobbyStore';
import { getRetroLobbyStore } from './retroLobbyStoreAccessor';

export function useRetroLobbyStore(): RetroLobbyStore {
  return getRetroLobbyStore(useRootStore());
}
