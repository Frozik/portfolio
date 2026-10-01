import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { SunStore } from './SunStore';

const SUN_STORE_KEY = 'sun';

/** One store for the route, refcounted so a visit later starts the test anew. */
export function useSunStore(): SunStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(SUN_STORE_KEY, () => new SunStore());
  useRefcountedFeatureStore(rootStore, SUN_STORE_KEY);
  return store;
}
