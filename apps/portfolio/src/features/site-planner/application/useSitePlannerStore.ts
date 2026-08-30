import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { SitePlannerStore } from './SitePlannerStore';

const SITE_PLANNER_STORE_KEY = 'site-planner';

/**
 * Acquire the `SitePlannerStore`. Refcounted so React strict-mode's
 * mount → cleanup → mount cycle reuses the same store instead of disposing the
 * one the mounted shell is already reading.
 */
export function useSitePlannerStore(): SitePlannerStore {
  const rootStore = useRootStore();

  const store = rootStore.getOrCreateFeatureStore(
    SITE_PLANNER_STORE_KEY,
    () => new SitePlannerStore()
  );

  useRefcountedFeatureStore(rootStore, SITE_PLANNER_STORE_KEY);

  return store;
}
