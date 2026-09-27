import type { TAnyColumn } from './columns/column';
import type { ITableExtension } from './kernel/extension';
import type { IRowChange } from './rows/row-change';
import type { TRowKey } from './rows/row-key';
import type { TRowSourceFactory } from './rows/row-source';
import type { ITableState } from './state/table-state';

export type TAnyExtension<TRow> = ITableExtension<TRow, string, unknown>;

export interface ITableOptions<TRow, TContext, TExtensions extends readonly TAnyExtension<TRow>[]> {
  readonly id?: string;
  readonly columns: readonly TAnyColumn<TRow>[];
  readonly rowKey: TRowKey<TRow>;
  readonly rows: TRowSourceFactory<TRow>;
  readonly pinnedRows?: {
    readonly top?: () => readonly TRow[];
    readonly bottom?: () => readonly TRow[];
  };
  readonly extensions: TExtensions;
  readonly context: TContext;
  readonly ready?: boolean;
  readonly initialState?: Partial<ITableState>;
  onRowChange?(change: IRowChange<TRow>): void | Promise<void>;
  onSourceError?(error: unknown): void;
}
