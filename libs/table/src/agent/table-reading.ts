import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil, range } from 'lodash-es';

import type { TAnyColumn } from '../core/columns/column';
import { columnText, columnTitle } from '../core/columns/column';
import type { ITableKernel } from '../core/kernel/kernel';
import type { IEditingSlice } from '../extensions/editing/contracts';
import type { IFilteringSlice } from '../extensions/filtering/contracts';
import type { GridViewSlice } from '../extensions/grid-view/core';
import type { ISortingSlice } from '../extensions/sorting/core';

const MAX_LISTED_VALUES = 50;

/** The slices an agent works through; any may be missing from a table. */
export interface ITableSlices<TRow> {
  readonly view: GridViewSlice<TRow> | undefined;
  readonly sorting: ISortingSlice | undefined;
  readonly filtering: IFilteringSlice | undefined;
  readonly editing: IEditingSlice<TRow> | undefined;
}

export function slicesOf<TRow>(table: ITableKernel<TRow, unknown>): ITableSlices<TRow> {
  return {
    view: table.extension<GridViewSlice<TRow>>('gridView'),
    sorting: table.extension<ISortingSlice>('sorting'),
    filtering: table.extension<IFilteringSlice>('filtering'),
    editing: table.extension<IEditingSlice<TRow>>('editing'),
  };
}

/** Data columns: the service columns (selection, detail toggle) are no business of an agent. */
export function dataColumns<TRow>(table: ITableKernel<TRow, unknown>): readonly TAnyColumn<TRow>[] {
  return table.columns.all.filter(column => !table.columns.isService(column.id));
}

function editability<TRow>(column: TAnyColumn<TRow>): 'yes' | 'some rows' | 'no' {
  if (isNil(column.set) || isNil(column.editable) || column.editable === false) {
    return 'no';
  }
  return column.editable === true ? 'yes' : 'some rows';
}

function enumKeys(options: unknown): readonly string[] | undefined {
  if (typeof options !== 'object' || isNil(options) || !('options' in options)) {
    return undefined;
  }
  const { options: choices } = options;
  return Array.isArray(choices)
    ? choices.flatMap(choice => (typeof choice?.key === 'string' ? [choice.key] : []))
    : undefined;
}

function filterOf<TRow>(slices: ITableSlices<TRow>, columnId: string) {
  const spec = slices.filtering?.specOf(columnId);
  if (isNil(spec) || !isNil(slices.filtering?.reasonAgainst(columnId))) {
    return null;
  }
  switch (spec.kind) {
    case 'set':
      return {
        kind: spec.kind,
        values: slices.filtering
          ?.valuesSeen(columnId)
          .slice(0, MAX_LISTED_VALUES)
          .map(value => (isNil(value) ? '' : String(value))),
      };
    case 'enum':
      return { kind: spec.kind, values: enumKeys(spec.options) };
    default:
      return { kind: spec.kind };
  }
}

/** Everything an agent needs before it acts: columns, counts, what is in view, sort, filters, edits. */
export function describeTable<TRow>(table: ITableKernel<TRow, unknown>) {
  const slices = slicesOf(table);
  const { view, sorting, filtering, editing } = slices;
  return {
    table: table.id ?? null,
    rows: {
      count: table.rows.rowCount ?? null,
      more: table.rows.hasMore,
      inView: isNil(view) ? null : view.visibleRows,
    },
    columns: dataColumns(table).map(column => ({
      id: column.id,
      title: columnTitle(column),
      kind: column.kind,
      hidden: table.columns.isHidden(column.id),
      editable: editability(column),
      sortable: !isNil(sorting) && isNil(sorting.reasonAgainst(column.id)),
      filter: filterOf(slices, column.id),
    })),
    sort: sorting?.sort ?? [],
    filters: filtering?.filters ?? {},
    search: filtering?.quick.text ?? '',
    edits: isNil(editing)
      ? null
      : { commitMode: editing.commitMode, unconfirmedRows: editing.pending },
  };
}

/** Rows by display index, each cell as the table shows it; group and placeholder rows say what they are. */
export function readRows<TRow>(
  table: ITableKernel<TRow, unknown>,
  from: number,
  count: number,
  columnIds?: readonly string[]
) {
  const total = table.rows.rowCount ?? 0;
  const columns = dataColumns(table).filter(column =>
    isNil(columnIds) ? !table.columns.isHidden(column.id) : columnIds.includes(column.id)
  );
  return range(from, Math.min(from + count, total)).map(index => {
    const displayRow = table.rows.rowAt(index);
    switch (displayRow.kind) {
      case 'leaf':
        return {
          index,
          key: displayRow.key,
          cells: Object.fromEntries(
            columns.map(column => [column.id, columnText(column, displayRow.row)])
          ),
        };
      case 'group':
        return {
          index,
          key: displayRow.key,
          group: { title: displayRow.group.title, rows: displayRow.group.rows.length },
        };
      case 'loading':
        return { index, key: displayRow.key, loading: true };
      case 'failed':
        return { index, key: displayRow.key, failed: true };
      default:
        return assertNever(displayRow);
    }
  });
}
