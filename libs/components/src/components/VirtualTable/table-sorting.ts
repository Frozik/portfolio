export type SortDirection = 'asc' | 'desc';

export type SortState = {
  readonly columnId: string;
  readonly direction: SortDirection;
};

/** What a header click does: first sort descending, then ascending, then off. */
export function nextSortState(current: SortState | null, columnId: string): SortState | null {
  if (current === null || current.columnId !== columnId) {
    return { columnId, direction: 'desc' };
  }
  return current.direction === 'desc' ? { columnId, direction: 'asc' } : null;
}

/**
 * Compares two cell values. Numbers and dates compare numerically, everything
 * else by locale so `Ель 10` sorts after `Ель 9` rather than before it.
 */
export function compareValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0;
  }
  if (left === null || left === undefined) {
    return 1;
  }
  if (right === null || right === undefined) {
    return -1;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

/** A new array sorted by `valueOf`; the input is left alone. */
export function sortRows<TRow>(
  rows: readonly TRow[],
  sort: SortState | null,
  valueOf: (row: TRow, columnId: string) => unknown
): readonly TRow[] {
  if (sort === null) {
    return rows;
  }
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort(
    (left, right) =>
      sign * compareValues(valueOf(left, sort.columnId), valueOf(right, sort.columnId))
  );
}
