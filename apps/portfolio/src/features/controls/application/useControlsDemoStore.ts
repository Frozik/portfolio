import { useRootStore } from '../../../app/stores/StoreContext';
import { ControlsDemoStore } from './ControlsDemoStore';

export function useControlsDemoStore(): ControlsDemoStore {
  return useRootStore().getOrCreateFeatureStore('controls-demo', () => new ControlsDemoStore());
}
