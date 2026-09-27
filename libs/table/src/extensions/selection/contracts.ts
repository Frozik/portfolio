import type { ICellPosition } from '../../core/focus/focus-model';
import type { TBivariantCallback } from '../../core/kernel/callback';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type {
  ISelectionMode,
  ISelectionPort,
  TRowSelectionMode,
} from '../../core/selection/selection-port';
import type { ICellRange, IRangeEdges } from './ranges';
import type { IRowSelection } from './row-set';

export type TSelectOnClick = 'row' | 'checkbox' | 'none';

export interface ISelectionOptions<TRow> {
  readonly rows?: TRowSelectionMode;
  readonly cells?: boolean;
  readonly checkboxes?: boolean;
  readonly headerCheckbox?: boolean;
  readonly selectOnClick?: TSelectOnClick;
  readonly selectable?: TBivariantCallback<[row: TRow], boolean>;
  /** Keep the selected rows in the table state so it survives a reload with persistence. */
  readonly persistSelection?: boolean;
}

export interface ISelectionState {
  readonly mode: ISelectionMode;
  readonly rows?: { readonly inverted: boolean; readonly keys: readonly string[] };
}

export interface ICellSelectionState {
  readonly selected: boolean;
  /** The edges of the block the cell closes, for the outline; `undefined` inside a block. */
  readonly edges: IRangeEdges | undefined;
}

export interface ISelectionSummary {
  readonly cells: number;
  readonly rows: number;
}

export type THeaderCheckboxState = 'none' | 'some' | 'all';

export interface ISelectionSlice<TRow> extends ISelectionPort<TRow> {
  readonly selectOnClick: TSelectOnClick;
  readonly headerCheckbox: boolean;
  readonly rows: IRowSelection;
  readonly anchor: string | null;
  readonly headerState: THeaderCheckboxState;
  readonly ranges: readonly ICellRange[];
  readonly summary: ISelectionSummary | undefined;
  readonly hasSelection: boolean;
  setMode(mode: Partial<ISelectionMode>): TCommandOutcome;
  isSelected(rowKey: string): boolean;
  reasonAgainst(rowKey: string): string | undefined;
  toggle(rowKey: string): TCommandOutcome;
  select(rowKey: string): TCommandOutcome;
  /** Rows from the anchor to the key in display order; replaces the selection unless `add` is set. */
  range(toKey: string, options?: { readonly add?: boolean }): TCommandOutcome;
  selectAll(): TCommandOutcome;
  clear(): TCommandOutcome;
  cellState(rowKey: string, columnId: string): ICellSelectionState;
  startRange(position: ICellPosition, options?: { readonly add?: boolean }): TCommandOutcome;
  extendRange(position: ICellPosition): TCommandOutcome;
  selectAllCells(): TCommandOutcome;
}
