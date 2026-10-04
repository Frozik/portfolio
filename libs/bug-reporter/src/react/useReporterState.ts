import { useCallback, useSyncExternalStore } from 'react';

import type { IReadableStore } from '../core/store';

export function useStoreSnapshot<TState>(store: IReadableStore<TState>): TState {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
