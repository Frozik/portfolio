import { Temporal } from 'temporal-polyfill';

import type { IPageSignals } from '../domain/ports/page-signals';
import type { ISessionClock } from '../domain/ports/session-clock';

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

export const BROWSER_PAGE_SIGNALS: IPageSignals = {
  isHidden: () => document.visibilityState === 'hidden',
  onActivity: listener => {
    const stops = ACTIVITY_EVENTS.map(type => listen(type, listener));
    return () => stops.forEach(stop => stop());
  },
  onVisibilityChange: listener => {
    const controller = new AbortController();
    document.addEventListener(
      'visibilitychange',
      () => listener(document.visibilityState === 'hidden'),
      { signal: controller.signal }
    );
    return () => controller.abort();
  },
  onPageHide: listener => listen('pagehide', listener),
  onOnline: listener => listen('online', listener),
  onRestoredFromCache: listener =>
    listen('pageshow', event => {
      if (event.persisted) {
        listener();
      }
    }),
};

export const BROWSER_SESSION_CLOCK: ISessionClock = {
  now: () => Temporal.Now.instant().epochMilliseconds,
  today: () => Temporal.Now.plainDateISO(),
  every: (ms, callback) => {
    const timer = setInterval(callback, ms);
    return () => clearInterval(timer);
  },
  after: (ms, callback) => {
    const timer = setTimeout(callback, ms);
    return () => clearTimeout(timer);
  },
};
