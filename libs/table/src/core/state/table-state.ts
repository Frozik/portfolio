import type { IColumnState } from '../columns/column-state';

/** The serializable part of a table: what differs from the definitions. */
export interface ITableState {
  readonly columns: readonly IColumnState[];
  readonly extensions: Readonly<Record<string, unknown>>;
}
