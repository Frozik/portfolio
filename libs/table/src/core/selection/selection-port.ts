export const SELECTION_ID = 'selection';

export type TRowSelectionMode = 'none' | 'single' | 'multiple';

export interface ISelectionMode {
  readonly rows: TRowSelectionMode;
  readonly cells: boolean;
}

/** A rectangle of cells in the current row and visible column order, both ends inclusive. */
export interface ICellBlock {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/**
 * What the kernel lets other extensions know about the selection, so that
 * clipboard, export and menus depend on this port and not on the selection
 * extension itself. Read it with `kernel.extension<ISelectionPort<TRow>>(SELECTION_ID)`.
 */
export interface ISelectionPort<TRow> {
  readonly mode: ISelectionMode;
  /** Selected rows; `undefined` when every row is selected and the source does not know its size yet. */
  readonly count: number | undefined;
  readonly blocks: readonly ICellBlock[];
  /** The selected rows that are in memory, in display order. */
  selectedRows(): readonly TRow[];
}
