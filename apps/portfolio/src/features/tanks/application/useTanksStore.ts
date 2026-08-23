import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { TanksStore } from './TanksStore';

const TANKS_STORE_KEY = 'tanks';

/** Refcounted with a grace window that absorbs the strict-mode mount → cleanup → mount cycle. */
export function useTanksStore(): TanksStore {
  const rootStore = useRootStore();

  const store = rootStore.getOrCreateFeatureStore(TANKS_STORE_KEY, () => new TanksStore());

  useRefcountedFeatureStore(rootStore, TANKS_STORE_KEY);

  return store;
}
