export type TRowKey<TRow> = keyof TRow | ((row: TRow) => string);

export function resolveRowKey<TRow>(rowKey: TRowKey<TRow>): (row: TRow) => string {
  if (typeof rowKey === 'function') {
    return rowKey;
  }
  return row => String(row[rowKey]);
}
