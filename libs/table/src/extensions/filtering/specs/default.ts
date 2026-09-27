import type { TAnyColumn } from '../../../core/columns/column';
import type { TFilterKind } from '../model';
import type { TAnyFilterSpec } from '../spec';
import { FILTER_KIND_BY_COLUMN_KIND } from '../spec';
import { booleanFilter } from './boolean';
import { dateFilter } from './date';
import { numberFilter } from './number';
import { setFilter } from './set';
import { textFilter } from './text';

function defaultSpecOf(kind: TFilterKind): TAnyFilterSpec | undefined {
  switch (kind) {
    case 'text':
      return textFilter();
    case 'number':
      return numberFilter();
    case 'date':
      return dateFilter();
    case 'set':
      return setFilter({ values: 'accumulate' });
    case 'boolean':
      return booleanFilter();
    case 'enum':
    case 'custom':
      return undefined;
  }
}

/** The spec a column's `filter` declaration stands for; `undefined` when the column cannot be filtered. */
export function resolveColumnFilter<TRow>(column: TAnyColumn<TRow>): TAnyFilterSpec | undefined {
  const { filter } = column;
  if (filter === undefined || filter === true) {
    const kind = filter === true ? FILTER_KIND_BY_COLUMN_KIND[column.kind] : undefined;
    return kind === undefined ? undefined : defaultSpecOf(kind);
  }
  return typeof filter === 'string' ? defaultSpecOf(filter) : (filter as TAnyFilterSpec);
}
