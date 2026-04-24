import { useRootStore } from '../../../app/stores/StoreContext';
import { createIdentityRepo } from '../infrastructure/identity-repo';
import { createUserDirectoryRepo } from '../infrastructure/user-directory-repo';
import { IdentityStore } from './IdentityStore';
import { UserDirectoryStore } from './UserDirectoryStore';

const IDENTITY_STORE_KEY = 'retro-identity';
const USER_DIRECTORY_KEY = 'retro-user-directory';

export function useIdentityStore(): IdentityStore {
  const rootStore = useRootStore();
  const directory = rootStore.getOrCreateFeatureStore(
    USER_DIRECTORY_KEY,
    () => new UserDirectoryStore(createUserDirectoryRepo())
  );
  return rootStore.getOrCreateFeatureStore(
    IDENTITY_STORE_KEY,
    () => new IdentityStore(createIdentityRepo(), directory)
  );
}
