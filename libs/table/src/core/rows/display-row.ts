export interface IGroupRow<TRow> {
  readonly key: string;
  /** The group value keys from the root down; empty for a totals row. */
  readonly path: readonly string[];
  readonly level: number;
  /** The column the group was made by; `undefined` for a totals row. */
  readonly columnId: string | undefined;
  readonly title: string;
  readonly expanded: boolean;
  /** Every leaf under the group, collapsed or not. */
  readonly rows: readonly TRow[];
  readonly count: number;
  readonly aggregates: Readonly<Record<string, unknown>>;
}

/**
 * What the kernel hands to a view, in display order. Without a grouping
 * extension every row is a leaf; a server source shows a `loading` or
 * `failed` placeholder where a row is not in memory yet.
 */
export type TDisplayRow<TRow> =
  | { readonly kind: 'leaf'; readonly key: string; readonly row: TRow }
  | { readonly kind: 'group'; readonly key: string; readonly group: IGroupRow<TRow> }
  | { readonly kind: 'loading'; readonly key: string }
  | { readonly kind: 'failed'; readonly key: string; readonly error: unknown };

export function leafRow<TRow>(key: string, row: TRow): TDisplayRow<TRow> {
  return { kind: 'leaf', key, row };
}
