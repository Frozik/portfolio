import type { ICellPosition } from '../../core/focus/focus-model';
import type { ICellBlock } from '../../core/selection/selection-port';

export interface ICellRange {
  readonly anchor: ICellPosition;
  readonly focus: ICellPosition;
}

export interface IRangeEdges {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
}

export interface IRangeResolver {
  rowIndexOf(rowKey: string): number | undefined;
  columnIndexOf(columnId: string): number | undefined;
}

/** The rectangle of a range in the current row and column order; `undefined` when a corner is not on screen. */
export function boundsOf(range: ICellRange, resolver: IRangeResolver): ICellBlock | undefined {
  const anchorRow = resolver.rowIndexOf(range.anchor.rowKey);
  const focusRow = resolver.rowIndexOf(range.focus.rowKey);
  const anchorColumn = resolver.columnIndexOf(range.anchor.columnId);
  const focusColumn = resolver.columnIndexOf(range.focus.columnId);
  if (
    anchorRow === undefined ||
    focusRow === undefined ||
    anchorColumn === undefined ||
    focusColumn === undefined
  ) {
    return undefined;
  }
  return {
    top: Math.min(anchorRow, focusRow),
    bottom: Math.max(anchorRow, focusRow),
    left: Math.min(anchorColumn, focusColumn),
    right: Math.max(anchorColumn, focusColumn),
  };
}

export function contains(bounds: ICellBlock, rowIndex: number, columnIndex: number): boolean {
  return (
    rowIndex >= bounds.top &&
    rowIndex <= bounds.bottom &&
    columnIndex >= bounds.left &&
    columnIndex <= bounds.right
  );
}

export function edgesOf(bounds: ICellBlock, rowIndex: number, columnIndex: number): IRangeEdges {
  return {
    top: rowIndex === bounds.top,
    bottom: rowIndex === bounds.bottom,
    left: columnIndex === bounds.left,
    right: columnIndex === bounds.right,
  };
}
