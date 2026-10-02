import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { createContext, useContext } from 'react';

import type { OfflinePackStore } from './OfflinePackStore';

const OfflinePackContext = createContext<OfflinePackStore | null>(null);

export const OfflinePackProvider = OfflinePackContext.Provider;

export function useOfflinePackStore(): OfflinePackStore {
  const store = useContext(OfflinePackContext);
  assert(!isNil(store), 'useOfflinePackStore must be used inside OfflinePackProvider');
  return store;
}
