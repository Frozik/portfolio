/** One confirmed row edit: the row as the application last gave it and the row every `set` made of it. */
export interface IRowChange<TRow> {
  readonly old: TRow;
  readonly new: TRow;
  readonly rowKey: string;
  /** The columns edited, in the order they were. */
  readonly fields: readonly string[];
}
