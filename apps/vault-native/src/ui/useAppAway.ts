import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

function subscribe(changed: () => void): () => void {
  const subscription = AppState.addEventListener('change', changed);
  return () => subscription.remove();
}

const isAway = (): boolean =>
  AppState.currentState === 'background' || AppState.currentState === 'inactive';

/** Whether the app is out of sight: in the background, or covered by the app switcher. */
export function useAppAway(): boolean {
  return useSyncExternalStore(subscribe, isAway);
}
