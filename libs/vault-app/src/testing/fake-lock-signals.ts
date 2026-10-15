import type { ILockSignalSource } from '../session/domain/ports/lock-signal-source';

/** An app under the test's hand: it reports activity, concealment and suspension when the test says so. */
export function createFakeLockSignals(concealed = false) {
  const listeners = {
    activity: new Set<() => void>(),
    concealed: new Set<(concealed: boolean) => void>(),
    unloading: new Set<() => void>(),
    resumed: new Set<() => void>(),
    online: new Set<() => void>(),
  };
  const subscribe =
    <T>(set: Set<T>) =>
    (listener: T) => {
      set.add(listener);
      return () => set.delete(listener);
    };

  const signals: ILockSignalSource = {
    isConcealed: () => concealed,
    onActivity: subscribe(listeners.activity),
    onConcealed: subscribe(listeners.concealed),
    onUnloading: subscribe(listeners.unloading),
    onResumedFromSuspend: subscribe(listeners.resumed),
    onOnline: subscribe(listeners.online),
  };

  return {
    signals,
    act: () => listeners.activity.forEach(listener => listener()),
    setConcealed(value: boolean): void {
      concealed = value;
      listeners.concealed.forEach(listener => listener(value));
    },
    unload: () => listeners.unloading.forEach(listener => listener()),
    resume: () => listeners.resumed.forEach(listener => listener()),
    comeOnline: () => listeners.online.forEach(listener => listener()),
    subscribers: () => Object.values(listeners).reduce((count, set) => count + set.size, 0),
  };
}
