import { useRootStore } from '../../../app/stores/StoreContext';
import type { UserDirectoryStore } from './UserDirectoryStore';
import { getUserDirectoryStore } from './userDirectoryStoreAccessor';

export function useUserDirectoryStore(): UserDirectoryStore {
  const rootStore = useRootStore();
  return getUserDirectoryStore(rootStore);
}
