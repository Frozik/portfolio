import { useRootStore } from '../../../app/stores/StoreContext';
import { useAuthSession } from '../../../shared/communication/CommunicationProvider';
import { createIdentityRepo } from '../infrastructure/identity-repo';
import { IdentityStore } from './IdentityStore';
import { getUserDirectoryStore } from './userDirectoryStoreAccessor';

const IDENTITY_STORE_KEY = 'retro-identity';

export function useIdentityStore(): IdentityStore {
  const rootStore = useRootStore();
  const session = useAuthSession();
  const directory = getUserDirectoryStore(rootStore);
  return rootStore.getOrCreateFeatureStore(
    IDENTITY_STORE_KEY,
    () => new IdentityStore(createIdentityRepo(), directory, session)
  );
}
