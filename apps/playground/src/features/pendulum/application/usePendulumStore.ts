import { useRootStore } from '../../../app/stores';
import { PendulumStore } from './PendulumStore';

export function usePendulumStore(): PendulumStore {
  const rootStore = useRootStore();
  return rootStore.getOrCreateFeatureStore(
    'pendulum',
    () => new PendulumStore(rootStore.commonStore)
  );
}
