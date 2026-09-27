import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { ColumnsModel } from '../columns/columns-model';
import type { IRowSource } from '../rows/row-source';

export interface ICellPosition {
  readonly rowKey: string;
  readonly columnId: string;
}

export type TFocusMove =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'pageUp'
  | 'pageDown'
  | 'home'
  | 'end'
  | 'rowStart'
  | 'rowEnd';

/** At most one focused cell; moves are intents so any adapter maps its own keys to them. */
export class FocusModel<TRow> {
  cell: ICellPosition | null = null;

  constructor(
    private readonly columns: ColumnsModel<TRow>,
    private readonly rows: () => IRowSource<TRow>
  ) {
    makeAutoObservable<FocusModel<TRow>, 'columns' | 'rows' | 'targetOf'>(
      this,
      { columns: false, rows: false, isFocused: false, targetOf: false },
      { autoBind: true }
    );
  }

  focusCell(rowKey: string, columnId: string): void {
    this.cell = { rowKey, columnId };
  }

  blur(): void {
    this.cell = null;
  }

  isFocused(rowKey: string, columnId: string): boolean {
    return this.cell?.rowKey === rowKey && this.cell.columnId === columnId;
  }

  move(direction: TFocusMove, pageRows = 1): void {
    const target = this.targetOf(direction, pageRows);
    if (!isNil(target)) {
      this.cell = target;
    }
  }

  private targetOf(direction: TFocusMove, pageRows: number): ICellPosition | undefined {
    const rows = this.rows();
    const visible = this.columns.visible;
    const rowCount = rows.rowCount ?? 0;
    if (rowCount === 0 || visible.length === 0) {
      return undefined;
    }
    const current = this.cell;
    const rowIndex = isNil(current) ? 0 : (rows.indexOf(current.rowKey) ?? 0);
    const columnIndex = isNil(current)
      ? 0
      : Math.max(
          0,
          visible.findIndex(layout => layout.id === current.columnId)
        );
    const lastRow = rowCount - 1;
    const lastColumn = visible.length - 1;
    const at = (row: number, columnAt: number): ICellPosition => ({
      rowKey: rows.keyAt(Math.max(0, Math.min(lastRow, row))),
      columnId: visible[Math.max(0, Math.min(lastColumn, columnAt))].id,
    });
    switch (direction) {
      case 'up':
        return at(rowIndex - 1, columnIndex);
      case 'down':
        return at(rowIndex + 1, columnIndex);
      case 'left':
        return at(rowIndex, columnIndex - 1);
      case 'right':
        return at(rowIndex, columnIndex + 1);
      case 'pageUp':
        return at(rowIndex - pageRows, columnIndex);
      case 'pageDown':
        return at(rowIndex + pageRows, columnIndex);
      case 'home':
        return at(0, columnIndex);
      case 'end':
        return at(lastRow, columnIndex);
      case 'rowStart':
        return at(rowIndex, 0);
      case 'rowEnd':
        return at(rowIndex, lastColumn);
    }
  }
}
