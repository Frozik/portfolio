import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { StereometryStore } from './StereometryStore';

/**
 * Keyed per puzzle so switching puzzles starts from a clean toolbar state
 * instead of inheriting the previous scene's undo/redo flags.
 */
function getStereometryStoreKey(puzzleId: string): string {
  return `stereometry:${puzzleId}`;
}

/**
 * Acquire the `StereometryStore` for one puzzle. Refcounted so React
 * strict-mode's mount → cleanup → mount cycle reuses the same store instead of
 * disposing the one the canvas effect has just bound its controls to.
 */
export function useStereometryStore(puzzleId: string): StereometryStore {
  const rootStore = useRootStore();
  const storeKey = getStereometryStoreKey(puzzleId);

  const store = rootStore.getOrCreateFeatureStore(storeKey, () => new StereometryStore());

  useRefcountedFeatureStore(rootStore, storeKey);

  return store;
}
