import type { ITableExtension } from '../../../core/kernel/extension';
import type { IGroupingOptions, IGroupingSlice } from '../../../extensions/grouping/core';
import { grouping as groupingCore } from '../../../extensions/grouping/core';
import { withView } from '../withView';
import { GroupLevelBadge } from './GroupLevelBadge';
import { GroupRow } from './GroupRow';
import { RevealScroller } from './RevealScroller';

/** Row grouping with its group rows, header level badges and scrolling on `reveal`. */
export function grouping<TRow = never>(
  options: IGroupingOptions<TRow> = {}
): ITableExtension<TRow, 'grouping', IGroupingSlice<TRow>> {
  return withView(groupingCore<TRow>(options), slice => ({
    row: GroupRow,
    'header.cell.parts': [
      {
        id: 'grouping.level',
        render: GroupLevelBadge,
        active: ({ column }) => slice.groupBy.includes(column.id),
      },
    ],
    floating: [{ id: 'grouping.reveal', render: RevealScroller }],
  }));
}
