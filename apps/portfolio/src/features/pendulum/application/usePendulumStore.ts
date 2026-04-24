import { useRootStore } from '../../../app/stores/StoreContext';
import { PendulumStore } from './PendulumStore';

export function usePendulumStore(): PendulumStore {
  const rootStore = useRootStore();
  return rootStore.getOrCreateFeatureStore(
    'pendulum',
    () => new PendulumStore(rootStore.commonStore)
  );
}
