import type { ITableExtension } from '../../../core/kernel/extension';
import type { IColumnMoveSlice } from '../../../extensions/column-move/core';
import { columnMove as columnMoveCore } from '../../../extensions/column-move/core';
import { withView } from '../withView';
import { createHeaderDrag } from './headerDrag';

/** Reordering by dragging a header; an insertion line shows where the column lands. */
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
        id: 'columnMove.indicator',
        decorate: ({ table, column, layout }) => {
          const drag = slice.drag;
          if (drag === null) {
            return undefined;
          }
          if (drag.columnId === column.id) {
            return { data: { dragging: true } };
          }
          if (drag.targetIndex === undefined) {
            return undefined;
          }
          const dragged = table.columns.visibleById.get(drag.columnId);
          if (dragged === undefined || dragged.section !== layout.section) {
            return undefined;
          }
          const section = table.columns.visible.filter(
            entry => entry.section === layout.section && entry.id !== drag.columnId
          );
          const before = section[drag.targetIndex]?.id === column.id;
          const after = drag.targetIndex >= section.length && section.at(-1)?.id === column.id;
          return before
            ? { data: { drop: 'before' } }
            : after
              ? { data: { drop: 'after' } }
              : undefined;
        },
      },
    ],
  }));
}
