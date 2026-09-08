import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import type { SpaceGolfStore } from './SpaceGolfStore';

const SPACE_GOLF_STORE_KEY = 'space-golf';

/**
 * One store for the route, refcounted so React strict-mode's mount → cleanup
 * → mount cycle reuses the store the canvas has just bound its renderer to.
 * The shell builds the store with its infrastructure and hands the factory in.
 */
export function useSpaceGolfStore(create: () => SpaceGolfStore): SpaceGolfStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(SPACE_GOLF_STORE_KEY, create);
  useRefcountedFeatureStore(rootStore, SPACE_GOLF_STORE_KEY);
  return store;
}
