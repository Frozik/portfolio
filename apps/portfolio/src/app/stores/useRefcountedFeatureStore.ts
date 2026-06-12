import { createRefcountedPool } from '@frozik/utils/refcountedPool';
import { useEffect } from 'react';

import type { RootStore } from './RootStore';

/**
 * The pool's "value" carries the bound disposer — the actual store lives in the
 * `RootStore`, so the value just records how to tear it down. The shared
 * refcount + grace logic (incl. absorbing React 19 strict-mode's dev
 * double-mount) lives in {@link createRefcountedPool}.
 */
const featureStorePool = createRefcountedPool<{ rootStore: RootStore; key: string }>(
  ({ rootStore, key }) => rootStore.disposeFeatureStore(key)
);

/**
 * Tie a `RootStore` feature-store entry to a component lifecycle while
 * honouring concurrent consumers and strict-mode remounts. Pair with a
 * `rootStore.getOrCreateFeatureStore(key, factory)` call placed in the
 * render body — this hook only owns the dispose timing.
 */
export function useRefcountedFeatureStore(rootStore: RootStore, key: string): void {
  useEffect(() => {
    featureStorePool.acquire(key, () => ({ rootStore, key }));
    return () => {
      featureStorePool.release(key);
    };
  }, [rootStore, key]);
}
