import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import type { TransportStore } from './TransportStore';

const TRANSPORT_STORE_KEY = 'transport';

/** The shell builds the store with its transport and hands the factory in. */
export function useTransportStore(create: () => TransportStore): TransportStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(TRANSPORT_STORE_KEY, create);
  useRefcountedFeatureStore(rootStore, TRANSPORT_STORE_KEY);
  return store;
}
