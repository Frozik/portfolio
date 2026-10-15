import type { ILockSignalSource } from '@frozik/vault-app/session/domain/ports/lock-signal-source';
import { addNetworkStateListener } from 'expo-network';
import { AppState } from 'react-native';

const NEVER = (): (() => void) => () => undefined;

/** At launch the state may still be `unknown`: only a known background conceals. */
const isAway = (state: string): boolean => state === 'background' || state === 'inactive';

export interface INativeLockSignals {
  readonly signals: ILockSignalSource;
  /** Fed by the root view's touches: a phone has no window to listen on. */
  readonly reportActivity: () => void;
}

/**
 * A phone app's signals. Android kills a background process without notice and
 * never restores a frozen one with its memory, so nothing ever reports
 * unloading or a resume from suspension: going to the background is the signal.
 */
export function createNativeLockSignals(): INativeLockSignals {
  const activityListeners = new Set<() => void>();
  return {
    reportActivity: () => activityListeners.forEach(listener => listener()),
    signals: {
      isConcealed: () => isAway(AppState.currentState),
      onActivity: listener => {
        activityListeners.add(listener);
        return () => activityListeners.delete(listener);
      },
      onConcealed: listener => {
        const subscription = AppState.addEventListener('change', state => listener(isAway(state)));
        return () => subscription.remove();
      },
      onUnloading: NEVER,
      onResumedFromSuspend: NEVER,
      onOnline: listener => {
        let online = true;
        const subscription = addNetworkStateListener(({ isInternetReachable }) => {
          const reachable = isInternetReachable !== false;
          if (reachable && !online) {
            listener();
          }
          online = reachable;
        });
        return () => subscription.remove();
      },
    },
  };
}
