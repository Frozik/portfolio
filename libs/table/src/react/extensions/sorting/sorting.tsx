import type { ITableExtension } from '../../../core/kernel/extension';
import type { ISortingOptions, ISortingSlice } from '../../../extensions/sorting/core';
import { sorting as sortingCore } from '../../../extensions/sorting/core';
import { withView } from '../withView';
import { SortIndicator } from './SortIndicator';

/** Sorting with its header UI: click cycles, Shift+click adds a column, the indicator shows direction and priority. */
export function sorting<TRow = never>(
  options: ISortingOptions = {}
): ITableExtension<TRow, 'sorting', ISortingSlice> {
  return withView(sortingCore<TRow>(options), slice => ({
    'header.cell.parts': [
      {
        id: 'sorting.indicator',
        render: SortIndicator,
        hoverOnly: true,
        active: ({ column }) => slice.directionOf(column.id) !== undefined,
      },
    ],
    'header.cell.decorate': [
      {
        id: 'sorting.state',
        decorate: ({ column }) => {
          if (slice.reasonAgainst(column.id) !== undefined) {
            return undefined;
          }
          const direction = slice.directionOf(column.id);
          return {
            data: { sortable: '' },
            aria: {
              sort:
                direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
            },
          };
        },
      },
    ],
    'header.cell.props': [
      {
        id: 'sorting.toggle',
        props: ({ column }) => ({
          onClick: event => {
            if (slice.reasonAgainst(column.id) === undefined) {
              slice.toggle(column.id, { multi: event.shiftKey });
            }
          },
        }),
      },
    ],
  }));
}
