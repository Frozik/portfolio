import type { HTMLAttributes, PointerEvent } from 'react';

import type { IColumnMoveSlice } from '../../../extensions/column-move/core';
import type { IHeaderContext } from '../../column';

const DRAG_THRESHOLD_PX = 4;

/** Controls inside a header own their pointer: a press on them never starts a column drag. */
const CONTROL_SELECTOR = 'button, input, select, textarea, [role="separator"]';

interface IDropTarget {
  readonly index: number;
  readonly group: string | undefined;
}

const COLUMN_HEADER_SELECTOR = '.ft-header-row:not(.ft-group-row) .ft-header-cell[data-column-id]';

/** The slot before `overId`, or after it, among the columns of the dragged column's section. */
function slotOf<TRow>(
  context: IHeaderContext<TRow>,
  overId: string,
  after: boolean
): number | undefined {
  const ownSection = context.layout.section;
  const sectionIds = context.table.columns.orderedIds.filter(
    id =>
      !context.table.columns.isHidden(id) &&
      context.table.columns.visibleById.get(id)?.section === ownSection
  );
  const overIndex = sectionIds.indexOf(overId);
  if (overIndex === -1) {
    return undefined;
  }
  const ownIndex = sectionIds.indexOf(context.column.id);
  const raw = after ? overIndex + 1 : overIndex;
  return raw > ownIndex ? raw - 1 : raw;
}

/** Over a group's header the column joins the group, as its first or last column by which half the pointer is in. */
function groupTargetAt<TRow>(
  context: IHeaderContext<TRow>,
  groupCell: HTMLElement,
  x: number
): IDropTarget | undefined {
  const groupId = groupCell.dataset.group;
  const root = groupCell.closest('.ft');
  if (groupId === undefined || root === null) {
    return undefined;
  }
  const bounds = groupCell.getBoundingClientRect();
  const columns = [...root.querySelectorAll<HTMLElement>(COLUMN_HEADER_SELECTOR)].filter(cell => {
    const rect = cell.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    return cell.closest('.ft') === root && centre > bounds.left && centre < bounds.right;
  });
  const first = columns[0]?.dataset.columnId;
  const last = columns.at(-1)?.dataset.columnId;
  if (first === undefined || last === undefined) {
    return undefined;
  }
  const atEnd = x > bounds.left + bounds.width / 2;
  const index = atEnd ? slotOf(context, last, true) : slotOf(context, first, false);
  return index === undefined ? undefined : { index, group: groupId };
}

function targetAt<TRow>(
  context: IHeaderContext<TRow>,
  x: number,
  y: number
): IDropTarget | undefined {
  const under = document.elementFromPoint(x, y);
  const groupCell = under?.closest<HTMLElement>('.ft-group-row .ft-header-cell[data-group]');
  if (groupCell !== null && groupCell !== undefined) {
    return groupTargetAt(context, groupCell, x);
  }
  const cell = under?.closest<HTMLElement>('[data-column-id]');
  if (cell === null || cell === undefined || cell.dataset.columnId === undefined) {
    return undefined;
  }
  const bounds = cell.getBoundingClientRect();
  const index = slotOf(context, cell.dataset.columnId, x > bounds.left + bounds.width / 2);
  return index === undefined ? undefined : { index, group: undefined };
}

/**
 * Pointer handlers that turn a header cell into a drag source for column
 * reordering. One gesture lives across renders: the header re-renders as
 * the drop indicator moves, so the origin of the press cannot live in the
 * handlers of one render. The pointer is captured only once the drag has
 * begun: a captured pointer retargets the click to the header cell, which
 * would take it away from the buttons inside.
 */
export function createHeaderDrag<TRow>(
  slice: IColumnMoveSlice
): (context: IHeaderContext<TRow>) => HTMLAttributes<HTMLDivElement> {
  let origin: { readonly x: number; readonly y: number } | null = null;
  return context => {
    if (slice.reasonAgainst(context.column.id) !== undefined) {
      return {};
    }
    return {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        const onControl =
          event.target instanceof Element && event.target.closest(CONTROL_SELECTOR) !== null;
        if (event.button !== 0 || onControl) {
          return;
        }
        origin = { x: event.clientX, y: event.clientY };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (origin === null) {
          return;
        }
        if (slice.drag === null) {
          if (Math.abs(event.clientX - origin.x) < DRAG_THRESHOLD_PX) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          slice.begin(context.column.id);
        }
        const target = targetAt(context, event.clientX, event.clientY);
        slice.hover(target?.index, target?.group);
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
  };
}
