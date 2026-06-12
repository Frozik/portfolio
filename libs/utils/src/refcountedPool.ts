/**
 * Default grace window before a released entry is torn down. Sized to absorb
 * React 19 strict-mode's dev double-mount (cleanup → immediate remount): the
 * cleanup decrements to zero and arms the timer; the remount cancels it before
 * it fires, so an expensive resource (sockets, WebGL contexts, MobX stores) is
 * never disposed and re-created across that cycle.
 */
const DEFAULT_GRACE_MS = 100;

interface IPoolEntry<T> {
  value: T;
  refCount: number;
  cleanupHandle: ReturnType<typeof setTimeout> | null;
}

export interface IRefcountedPool<T> {
  /**
   * Return the shared value for `key`, creating it via `create` on first use.
   * Cancels any pending deferred teardown. Every `acquire` must be paired with
   * exactly one `release`.
   */
  acquire(key: string, create: () => T): T;
  /** Drop one reference; the value is torn down after the grace window once the count hits zero. */
  release(key: string): void;
}

/**
 * Key-scoped pool that shares one `T` between concurrent consumers and tears it
 * down (via `dispose`) only after the last consumer leaves and a short grace
 * window elapses. Used for Socket.IO clients and refcounted feature stores —
 * anything whose construction is expensive and must be shared per key.
 */
export function createRefcountedPool<T>(
  dispose: (value: T) => void,
  graceMs: number = DEFAULT_GRACE_MS
): IRefcountedPool<T> {
  const entries = new Map<string, IPoolEntry<T>>();

  return {
    acquire(key: string, create: () => T): T {
      const cached = entries.get(key);
      if (cached !== undefined) {
        if (cached.cleanupHandle !== null) {
          clearTimeout(cached.cleanupHandle);
          cached.cleanupHandle = null;
        }
        cached.refCount += 1;
        return cached.value;
      }
      const value = create();
      entries.set(key, { value, refCount: 1, cleanupHandle: null });
      return value;
    },

    release(key: string): void {
      const entry = entries.get(key);
      if (entry === undefined) {
        return;
      }
      entry.refCount -= 1;
      if (entry.refCount > 0) {
        return;
      }
      entry.cleanupHandle = setTimeout(() => {
        const current = entries.get(key);
        if (current === undefined || current.refCount > 0) {
          return;
        }
        entries.delete(key);
        dispose(current.value);
      }, graceMs);
    },
  };
}
