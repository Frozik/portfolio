import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { createContext, useContext } from 'react';

import type { RootStore } from './RootStore';

const StoreContext = createContext<RootStore | null>(null);

export const StoreProvider = StoreContext.Provider;

export function useRootStore(): RootStore {
  const store = useContext(StoreContext);
  assert(!isNil(store), 'useRootStore must be used inside StoreProvider');
  return store;
}
