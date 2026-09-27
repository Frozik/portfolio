import { useEffect } from 'react';

import { useTableContext } from '../../context';
import { gridViewOf } from '../../grid/gridViewOf';
import type { IViewContext } from '../../slots';

/** Headless: scrolls to a leaf once `reveal` has expanded the groups above it. */
export function RevealScroller<TRow>(_: IViewContext<TRow>) {
  const { table } = useTableContext<TRow>();
  useEffect(
    () =>
      table.events.on('grouping.revealed', ({ rowKey }) => {
        const index = table.rows.indexOf(rowKey);
        if (index !== undefined) {
          gridViewOf(table).scrollToRow(index);
        }
      }),
    [table]
  );
  return null;
}
