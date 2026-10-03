import type { ITableExtension } from '../../../core/kernel/extension';
import type { IColumnMoveSlice } from '../../../extensions/column-move/core';
import { columnMove as columnMoveCore } from '../../../extensions/column-move/core';
import { withView } from '../withView';
import { createHeaderDrag } from './headerDrag';

/** Reordering by dragging a header: the column stands where it would land, and the drop fixes it there. */
export function columnMove<TRow = never>(): ITableExtension<TRow, 'columnMove', IColumnMoveSlice> {
  return withView(columnMoveCore<TRow>(), slice => ({
    'header.cell.props': [{ id: 'columnMove.drag', props: createHeaderDrag(slice) }],
    'header.group.decorate': [
      {
        id: 'columnMove.groupTarget',
        decorate: ({ group }) =>
          slice.drag?.targetGroup === group.id ? { data: { 'drop-group': true } } : undefined,
      },
    ],
    'header.cell.decorate': [
      {
        id: 'columnMove.dragging',
        decorate: ({ column }) =>
          slice.drag?.columnId === column.id ? { data: { dragging: true } } : undefined,
      },
    ],
  }));
}
