import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { PendulumStore } from './PendulumStore';

const PENDULUM_STORE_KEY = 'pendulum';

/**
 * Acquire the shared `PendulumStore`. Refcounted via
 * `useRefcountedFeatureStore`: all pendulum components share one store
 * instance; the store is disposed (subscriptions torn down) only after
 * every consumer has unmounted, with a short grace window absorbing the
 * React strict-mode mount → cleanup → mount cycle.
 */
export function usePendulumStore(): PendulumStore {
  const rootStore = useRootStore();

  const store = rootStore.getOrCreateFeatureStore(PENDULUM_STORE_KEY, () => new PendulumStore());

  useRefcountedFeatureStore(rootStore, PENDULUM_STORE_KEY);

  return store;
}
