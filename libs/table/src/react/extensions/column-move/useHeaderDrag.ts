import type { HTMLAttributes, PointerEvent } from 'react';

import type { IColumnMoveSlice } from '../../../extensions/column-move/core';
import type { IHeaderContext } from '../../column';

const DRAG_THRESHOLD_PX = 4;

function targetIndexAt<TRow>(
  context: IHeaderContext<TRow>,
  x: number,
  y: number
): number | undefined {
  const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-column-id]');
  if (cell === null || cell === undefined) {
    return undefined;
  }
  const overId = cell.dataset.columnId;
  const ownSection = context.layout.section;
  const sectionIds = context.table.columns.orderedIds.filter(
    id =>
      !context.table.columns.isHidden(id) &&
      context.table.columns.visibleById.get(id)?.section === ownSection
  );
  const overIndex = sectionIds.indexOf(overId ?? '');
  if (overIndex === -1) {
    return undefined;
  }
  const bounds = cell.getBoundingClientRect();
  const after = x > bounds.left + bounds.width / 2;
  const ownIndex = sectionIds.indexOf(context.column.id);
  const raw = after ? overIndex + 1 : overIndex;
  return raw > ownIndex ? raw - 1 : raw;
}

/** Pointer handlers that turn a header cell into a drag source for column reordering. */
export function headerDragProps<TRow>(
  slice: IColumnMoveSlice,
  context: IHeaderContext<TRow>
): HTMLAttributes<HTMLDivElement> {
  if (slice.reasonAgainst(context.column.id) !== undefined) {
    return {};
  }
  let origin: { readonly x: number; readonly y: number } | null = null;
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      origin = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (origin === null) {
        return;
      }
      if (slice.drag === null) {
        if (Math.abs(event.clientX - origin.x) < DRAG_THRESHOLD_PX) {
          return;
        }
        slice.begin(context.column.id);
      }
      slice.hover(targetIndexAt(context, event.clientX, event.clientY));
    },
    onPointerUp: () => {
      origin = null;
      slice.drop();
    },
    onPointerCancel: () => {
      origin = null;
      slice.cancel();
    },
    onClickCapture: event => {
      if (slice.drag !== null) {
        event.stopPropagation();
      }
    },
  };
}
