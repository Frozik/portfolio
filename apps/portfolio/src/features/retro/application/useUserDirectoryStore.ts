import { useRootStore } from '../../../app/stores';
import { createUserDirectoryRepo } from '../infrastructure/user-directory-repo';
import { UserDirectoryStore } from './UserDirectoryStore';

const USER_DIRECTORY_KEY = 'retro-user-directory';

export function useUserDirectoryStore(): UserDirectoryStore {
  const rootStore = useRootStore();
  return rootStore.getOrCreateFeatureStore(
    USER_DIRECTORY_KEY,
    () => new UserDirectoryStore(createUserDirectoryRepo())
  );
}
