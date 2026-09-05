import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { StereometryStore } from './StereometryStore';

const STEREOMETRY_STORE_KEY = 'stereometry';

/**
 * One store for the route: the toolbar mode survives switching puzzles, while
 * undo/redo availability comes from the session each canvas mount attaches.
 * Refcounted so React strict-mode's mount → cleanup → mount cycle reuses the
 * store the canvas effect has just bound its session to.
 */
export function useStereometryStore(): StereometryStore {
  const rootStore = useRootStore();

  const store = rootStore.getOrCreateFeatureStore(
    STEREOMETRY_STORE_KEY,
    () => new StereometryStore()
  );

  useRefcountedFeatureStore(rootStore, STEREOMETRY_STORE_KEY);

  return store;
}
