import { isNil } from 'lodash-es';

import type { TAnyColumn } from '../../core/columns/column';
import { columnText } from '../../core/columns/column';
import type { IGroupRow, TDisplayRow } from '../../core/rows/display-row';
import { aggregateRows } from './aggregate';

const PATH_SEPARATOR = '\u0000';
export const GROUP_KEY_PREFIX = 'group:';
export const TOTALS_KEY = 'totals';

export function groupKey(path: readonly string[]): string {
  return GROUP_KEY_PREFIX + path.join(PATH_SEPARATOR);
}

export function isGroupKey(rowKey: string): boolean {
  return rowKey.startsWith(GROUP_KEY_PREFIX);
}

export type TGroupOrder<TRow> = (left: IGroupRow<TRow>, right: IGroupRow<TRow>) => number;

export interface IGroupTreeOptions<TRow> {
  readonly columns: readonly TAnyColumn<TRow>[];
  readonly aggregated: readonly TAnyColumn<TRow>[];
  isExpanded(path: readonly string[]): boolean;
  readonly order?: TGroupOrder<TRow>;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function byTitle<TRow>(left: IGroupRow<TRow>, right: IGroupRow<TRow>): number {
  return collator.compare(left.title, right.title);
}

function valueKey<TRow>(column: TAnyColumn<TRow>, row: TRow): string {
  const value = column.value(row);
  return isNil(value) ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function titleOf<TRow>(column: TAnyColumn<TRow>, row: TRow): string {
  return column.groupTitle?.(column.value(row)) ?? columnText(column, row);
}

function groupsAt<TRow>(
  leaves: readonly TDisplayRow<TRow>[],
  parentPath: readonly string[],
  options: IGroupTreeOptions<TRow>
): readonly TDisplayRow<TRow>[] {
  const level = parentPath.length;
  const column = options.columns[level];
  if (column === undefined) {
    return leaves;
  }
  const buckets = new Map<string, { title: string; members: TDisplayRow<TRow>[] }>();
  for (const leaf of leaves) {
    if (leaf.kind !== 'leaf') {
      continue;
    }
    const key = valueKey(column, leaf.row);
    const bucket = buckets.get(key) ?? { title: titleOf(column, leaf.row), members: [] };
    bucket.members.push(leaf);
    buckets.set(key, bucket);
  }
  const groups = [...buckets].map(([key, bucket]) => {
    const path = [...parentPath, key];
    const rows = bucket.members.flatMap(member => (member.kind === 'leaf' ? [member.row] : []));
    const group: IGroupRow<TRow> = {
      key: groupKey(path),
      path,
      level,
      columnId: column.id,
      title: bucket.title,
      expanded: options.isExpanded(path),
      rows,
      count: rows.length,
      aggregates: aggregateRows(options.aggregated, rows),
    };
    return { group, members: bucket.members };
  });
  groups.sort((left, right) => (options.order ?? byTitle)(left.group, right.group));
  return groups.flatMap(({ group, members }) => {
    const row: TDisplayRow<TRow> = { kind: 'group', key: group.key, group };
    return group.expanded ? [row, ...groupsAt(members, group.path, options)] : [row];
  });
}

/** Leaves → the flattened tree of group rows with the leaves of every expanded group under it. */
export function groupTree<TRow>(
  leaves: readonly TDisplayRow<TRow>[],
  options: IGroupTreeOptions<TRow>
): readonly TDisplayRow<TRow>[] {
  return options.columns.length === 0 ? leaves : groupsAt(leaves, [], options);
}

export function totalsRow<TRow>(
  rows: readonly TRow[],
  aggregated: readonly TAnyColumn<TRow>[],
  title: string
): TDisplayRow<TRow> {
  return {
    kind: 'group',
    key: TOTALS_KEY,
    group: {
      key: TOTALS_KEY,
      path: [],
      level: -1,
      columnId: undefined,
      title,
      expanded: false,
      rows,
      count: rows.length,
      aggregates: aggregateRows(aggregated, rows),
    },
  };
}
