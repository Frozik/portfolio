import type { ITableExtension } from '../../../core/kernel/extension';
import type {
  IColumnResizeOptions,
  IColumnResizeSlice,
} from '../../../extensions/column-resize/core';
import { columnResize as columnResizeCore } from '../../../extensions/column-resize/core';
import { withView } from '../withView';
import { ResizeHandle } from './ResizeHandle';

/** Column resizing with a drag handle in every header; double-click fits the column to its content. */
export function columnResize<TRow = never>(
  options: IColumnResizeOptions = {}
): ITableExtension<TRow, 'columnResize', IColumnResizeSlice> {
  return withView(columnResizeCore<TRow>(options), () => ({
    'header.cell.parts': [{ id: 'columnResize.handle', render: ResizeHandle }],
  }));
}
