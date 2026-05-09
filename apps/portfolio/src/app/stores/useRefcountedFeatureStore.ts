import { useEffect } from 'react';

import type { RootStore } from './RootStore';

/**
 * Module-scoped refcount table for feature stores. React 19 strict mode
 * runs every effect twice in dev (mount → cleanup → mount); a synchronous
 * `disposeFeatureStore` on cleanup tears down the store — heavy stores
 * (FaceLandmarker WebGL contexts, RTCPeerConnection, MediaStream
 * composers, Yjs providers) re-initialise on the second mount, which
 * appears as long re-init cycles in the console.
 *
 * The refcount + deferred dispose absorbs the cycle: the strict-mode
 * cleanup arms a short timer, the immediate remount cancels it, and only
 * a real "all consumers gone" unmount actually disposes the store.
 */
interface IRefEntry {
  count: number;
  cleanupHandle: ReturnType<typeof setTimeout> | null;
}

const STRICT_MODE_GRACE_MS = 100;
const refCounts = new Map<string, IRefEntry>();

/**
 * Tie a `RootStore` feature-store entry to a component lifecycle while
 * honouring concurrent consumers and strict-mode remounts. Pair with a
 * `rootStore.getOrCreateFeatureStore(key, factory)` call placed in the
 * render body — this hook only owns the dispose timing.
 */
export function useRefcountedFeatureStore(rootStore: RootStore, key: string): void {
  useEffect(() => {
    const cached = refCounts.get(key);
    if (cached !== undefined) {
      if (cached.cleanupHandle !== null) {
        clearTimeout(cached.cleanupHandle);
        cached.cleanupHandle = null;
      }
      cached.count += 1;
    } else {
      refCounts.set(key, { count: 1, cleanupHandle: null });
    }

    return () => {
      const entry = refCounts.get(key);
      if (entry === undefined) {
        return;
      }
      entry.count -= 1;
      if (entry.count > 0) {
        return;
      }
      entry.cleanupHandle = setTimeout(() => {
        const current = refCounts.get(key);
        if (current === undefined || current.count > 0) {
          return;
        }
        rootStore.disposeFeatureStore(key);
        refCounts.delete(key);
      }, STRICT_MODE_GRACE_MS);
    };
  }, [rootStore, key]);
}
