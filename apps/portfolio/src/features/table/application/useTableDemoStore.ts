import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { TableDemoStore } from './TableDemoStore';

const TABLE_DEMO_STORE_KEY = 'table-demo';

export function useTableDemoStore(): TableDemoStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(TABLE_DEMO_STORE_KEY, () => new TableDemoStore());
  useRefcountedFeatureStore(rootStore, TABLE_DEMO_STORE_KEY);
  return store;
}
