/** One committed edit: the row as it was, the row as `set` made it, and where it happened. */
export interface IRowChange<TRow> {
  readonly row: TRow;
  readonly next: TRow;
  readonly rowKey: string;
  readonly columnId: string;
}
