/**
 * Selected rows as a set of keys, or as "every row except these" so that
 * select-all works on a server source that never has every row in memory.
 */
export interface IRowSelection {
  readonly inverted: boolean;
  readonly keys: ReadonlySet<string>;
}

export const NO_ROWS: IRowSelection = { inverted: false, keys: new Set() };
export const ALL_ROWS: IRowSelection = { inverted: true, keys: new Set() };

export function isRowSelected(selection: IRowSelection, rowKey: string): boolean {
  return selection.inverted ? !selection.keys.has(rowKey) : selection.keys.has(rowKey);
}

export function withRow(
  selection: IRowSelection,
  rowKey: string,
  selected: boolean
): IRowSelection {
  const keys = new Set(selection.keys);
  if (selected !== selection.inverted) {
    keys.add(rowKey);
  } else {
    keys.delete(rowKey);
  }
  return { inverted: selection.inverted, keys };
}

export function withRows(
  selection: IRowSelection,
  rowKeys: readonly string[],
  selected: boolean
): IRowSelection {
  return rowKeys.reduce((current, rowKey) => withRow(current, rowKey, selected), selection);
}

export function selectedCount(
  selection: IRowSelection,
  rowCount: number | undefined
): number | undefined {
  if (!selection.inverted) {
    return selection.keys.size;
  }
  return rowCount === undefined ? undefined : Math.max(0, rowCount - selection.keys.size);
}

export function isEmptySelection(selection: IRowSelection): boolean {
  return !selection.inverted && selection.keys.size === 0;
}
