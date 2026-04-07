import { CommonStore } from './CommonStore';

interface IDisposable {
  dispose: () => void;
}

function isDisposable(value: unknown): value is IDisposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispose' in value &&
    typeof (value as IDisposable).dispose === 'function'
  );
}

export class RootStore {
  readonly commonStore = new CommonStore();

  private featureStores = new Map<string, unknown>();

  getOrCreateFeatureStore<T>(key: string, factory: () => T): T {
    if (!this.featureStores.has(key)) {
      this.featureStores.set(key, factory());
    }
    return this.featureStores.get(key) as T;
  }

  disposeFeatureStore(key: string): void {
    const store = this.featureStores.get(key);
    if (isDisposable(store)) {
      store.dispose();
    }
    this.featureStores.delete(key);
  }
}
