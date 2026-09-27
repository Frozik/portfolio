import { createContext, useContext } from 'react';

import { assert } from '@frozik/utils/assert/assert';

import type { IFilteringSlice } from '../../../extensions/filtering/contracts';
import type { FilterUiState } from './ui-state';

export interface IFilteringContext {
  readonly slice: IFilteringSlice;
  readonly ui: FilterUiState;
  readonly debounceMs: number;
}

const FilteringContext = createContext<IFilteringContext | undefined>(undefined);

export const FilteringProvider = FilteringContext.Provider;

export function useFiltering(): IFilteringContext {
  const value = useContext(FilteringContext);
  assert(value !== undefined, 'Filter UI renders only inside the filtering extension');
  return value;
}
