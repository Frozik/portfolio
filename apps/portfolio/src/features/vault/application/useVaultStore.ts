import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import type { VaultFeatureStore } from './VaultFeatureStore';

const VAULT_STORE_KEY = 'vault';

/** The shell builds the store with its device stores and hands the factory in. */
export function useVaultStore(create: () => VaultFeatureStore): VaultFeatureStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(VAULT_STORE_KEY, create);
  useRefcountedFeatureStore(rootStore, VAULT_STORE_KEY);
  return store;
}
