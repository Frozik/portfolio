import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { ScorchedStore } from './ScorchedStore';

const SCORCHED_STORE_KEY = 'scorched';

/**
 * Acquire the shared `ScorchedStore`. Refcounted because the round it holds is what the GPU
 * layers read: the store is torn down only once every consumer unmounted, with a grace window
 * that absorbs the React strict-mode mount → cleanup → mount cycle.
 */
export function useScorchedStore(): ScorchedStore {
  const rootStore = useRootStore();

  const store = rootStore.getOrCreateFeatureStore(SCORCHED_STORE_KEY, () => new ScorchedStore());

  useRefcountedFeatureStore(rootStore, SCORCHED_STORE_KEY);

  return store;
}
