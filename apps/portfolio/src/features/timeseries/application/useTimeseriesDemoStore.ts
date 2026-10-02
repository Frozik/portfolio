import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { TimeseriesDemoStore } from './TimeseriesDemoStore';

const TIMESERIES_DEMO_STORE_KEY = 'timeseries-demo';

export function useTimeseriesDemoStore(): TimeseriesDemoStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(
    TIMESERIES_DEMO_STORE_KEY,
    () => new TimeseriesDemoStore()
  );
  useRefcountedFeatureStore(rootStore, TIMESERIES_DEMO_STORE_KEY);
  return store;
}
