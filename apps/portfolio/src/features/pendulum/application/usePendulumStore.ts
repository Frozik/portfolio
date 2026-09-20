import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { NetworkPlayer } from '../domain/players/NetworkPlayer';
import { animationFrameScheduler } from '../infrastructure/animation-frame-scheduler';
import { createIndexedDbGenerationsRepository } from '../infrastructure/IndexedDBGenerationsRepository';
import { WindowKeyStateSource } from '../infrastructure/WindowKeyStateSource';
import { PendulumStore } from './PendulumStore';

const PENDULUM_STORE_KEY = 'pendulum';

/** Composition root of the feature: every pendulum panel shares one refcounted store. */
export function usePendulumStore(): PendulumStore {
  const rootStore = useRootStore();

  const store = rootStore.getOrCreateFeatureStore(
    PENDULUM_STORE_KEY,
    () =>
      new PendulumStore({
        repository: createIndexedDbGenerationsRepository(),
        frames: animationFrameScheduler,
        createKeyStateSource: () => new WindowKeyStateSource(),
        loadRobot: record => NetworkPlayer.fromSnapshot(record.name, record.network),
      })
  );

  useRefcountedFeatureStore(rootStore, PENDULUM_STORE_KEY);

  return store;
}
