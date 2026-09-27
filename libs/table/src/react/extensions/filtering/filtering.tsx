import type { ReactNode } from 'react';

import type { IExtensionInstance, ITableExtension } from '../../../core/kernel/extension';
import type { IFilteringOptions, IFilteringSlice } from '../../../extensions/filtering/contracts';
import { filtering as filteringCore } from '../../../extensions/filtering/core';
import type { IViewContributions } from '../../slots';
import { FilterButton } from './FilterButton';
import type { IFilteringContext } from './filtering-context';
import { FilteringProvider } from './filtering-context';
import { FilterPopover } from './FilterPopover';
import { FilterRow } from './FilterRow';
import { FilterSummary } from './FilterSummary';
import { FilterUiState } from './ui-state';

const DEFAULT_DEBOUNCE_MS = 250;

export interface IFilteringViewOptions extends IFilteringOptions {
  readonly debounceMs?: number;
}

function provided<TProps extends object>(
  context: IFilteringContext,
  Component: (props: TProps) => ReactNode
): (props: TProps) => ReactNode {
  return props => (
    <FilteringProvider value={context}>
      <Component {...props} />
    </FilteringProvider>
  );
}

function filteringView<TRow>(context: IFilteringContext): IViewContributions<TRow> {
  return {
    'header.cell.parts': [
      {
        id: 'filtering.button',
        render: provided(context, FilterButton<TRow>),
        hoverOnly: true,
        active: ({ column }) => context.slice.modelOf(column.id) !== undefined,
      },
    ],
    'header.row.after': provided(context, FilterRow<TRow>),
    toolbar: [{ id: 'filtering.summary', render: provided(context, FilterSummary<TRow>) }],
    floating: [{ id: 'filtering.popover', render: provided(context, FilterPopover<TRow>) }],
  };
}

/** Column filters with a header button, an optional filter row and a popover editor; the model stays in the core slice. */
export function filtering<TRow = never>(
  options: IFilteringViewOptions = {}
): ITableExtension<TRow, 'filtering', IFilteringSlice> {
  const core = filteringCore<TRow>(options);
  return {
    ...core,
    create(kernel): IExtensionInstance<TRow, IFilteringSlice> {
      const instance = core.create(kernel);
      const context: IFilteringContext = {
        slice: instance.slice,
        ui: new FilterUiState(),
        debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      };
      return {
        ...instance,
        view: filteringView<TRow>(context) as Readonly<Record<string, unknown>>,
      };
    },
  };
}
