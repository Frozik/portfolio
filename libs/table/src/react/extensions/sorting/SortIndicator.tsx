import { observer } from 'mobx-react-lite';

import type { ISortingSlice } from '../../../extensions/sorting/core';
import type { IHeaderContext } from '../../column';
import { useTableContext } from '../../context';

const ARROW: Readonly<Record<'asc' | 'desc' | 'none', string>> = { asc: '↑', desc: '↓', none: '↕' };

export const SortIndicator = observer(function SortIndicator<TRow>({
  table,
  column,
}: IHeaderContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const sorting = table.extension<ISortingSlice>('sorting');
  if (sorting === undefined || sorting.reasonAgainst(column.id) !== undefined) {
    return null;
  }
  const direction = sorting.directionOf(column.id);
  const priority = sorting.priorityOf(column.id);
  const label =
    direction === 'asc'
      ? translations.sortAscending
      : direction === 'desc'
        ? translations.sortDescending
        : translations.sortNone;
  return (
    <>
      <span aria-label={label} title={label}>
        {ARROW[direction ?? 'none']}
      </span>
      {priority !== undefined && sorting.sort.length > 1 && (
        <span className="ft-sort-priority" title={translations.sortPriority(priority)}>
          {priority}
        </span>
      )}
    </>
  );
});
