import type { IPageSignals } from '../domain/ports/page-signals';

/** A page under the test's hand: it reports activity, visibility and navigation when the test says so. */
export function createFakePageSignals(hidden = false) {
  const listeners = {
    activity: new Set<() => void>(),
    visibility: new Set<(hidden: boolean) => void>(),
    pageHide: new Set<() => void>(),
    restored: new Set<() => void>(),
    online: new Set<() => void>(),
  };
  const subscribe =
    <T>(set: Set<T>) =>
    (listener: T) => {
      set.add(listener);
      return () => set.delete(listener);
    };

  const page: IPageSignals = {
    isHidden: () => hidden,
    onActivity: subscribe(listeners.activity),
    onVisibilityChange: subscribe(listeners.visibility),
    onPageHide: subscribe(listeners.pageHide),
    onRestoredFromCache: subscribe(listeners.restored),
    onOnline: subscribe(listeners.online),
  };

  return {
    page,
    act: () => listeners.activity.forEach(listener => listener()),
    setHidden(value: boolean): void {
      hidden = value;
      listeners.visibility.forEach(listener => listener(value));
    },
    hide: () => listeners.pageHide.forEach(listener => listener()),
    restore: () => listeners.restored.forEach(listener => listener()),
    comeOnline: () => listeners.online.forEach(listener => listener()),
    subscribers: () => Object.values(listeners).reduce((count, set) => count + set.size, 0),
  };
}
