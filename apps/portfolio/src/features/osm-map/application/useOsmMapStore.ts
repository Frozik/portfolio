import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import type { OsmMapStore } from './OsmMapStore';

const OSM_MAP_STORE_KEY = 'osm-map';

/**
 * One store for the route, refcounted so strict mode's remount reuses it.
 * The shell builds the store with its infrastructure and hands the factory in.
 */
export function useOsmMapStore(create: () => OsmMapStore): OsmMapStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(OSM_MAP_STORE_KEY, create);
  useRefcountedFeatureStore(rootStore, OSM_MAP_STORE_KEY);
  return store;
}
