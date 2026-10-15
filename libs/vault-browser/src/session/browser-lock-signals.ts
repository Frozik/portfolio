import type { ILockSignalSource } from '@frozik/vault-app/session/domain/ports/lock-signal-source';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;

function listen<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void
): () => void {
  const controller = new AbortController();
  window.addEventListener(type, listener, {
    capture: true,
    passive: true,
    signal: controller.signal,
  });
  return () => controller.abort();
}

export const BROWSER_LOCK_SIGNALS: ILockSignalSource = {
  isConcealed: () => document.visibilityState === 'hidden',
  onActivity: listener => {
    const stops = ACTIVITY_EVENTS.map(type => listen(type, listener));
    return () => stops.forEach(stop => stop());
  },
  onConcealed: listener => {
    const controller = new AbortController();
    document.addEventListener(
      'visibilitychange',
      () => listener(document.visibilityState === 'hidden'),
      { signal: controller.signal }
    );
    return () => controller.abort();
  },
  onUnloading: listener => listen('pagehide', listener),
  onOnline: listener => listen('online', listener),
  onResumedFromSuspend: listener =>
    listen('pageshow', event => {
      if (event.persisted) {
        listener();
      }
    }),
};
