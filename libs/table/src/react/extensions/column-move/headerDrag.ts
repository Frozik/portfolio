import { isNil } from 'lodash-es';
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

/**
 * The column under the pointer, or nothing to change: the dragged column
 * already stands where it last landed, so the pointer over it names no new
 * slot — asking would send the column back to its own place.
 */
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
  const overId = cell?.dataset.columnId;
  if (isNil(cell) || isNil(overId) || overId === context.column.id) {
    return undefined;
  }
  const bounds = cell.getBoundingClientRect();
  const index = slotOf(context, overId, x > bounds.left + bounds.width / 2);
  return index === undefined ? undefined : { index, group: undefined };
}

/** Follows one drag on the document, where the pointer keeps arriving as the header cells change places under it. */
function follow<TRow>(context: IHeaderContext<TRow>, slice: IColumnMoveSlice): void {
  const onMove = (event: globalThis.PointerEvent) => {
    const target = targetAt(context, event.clientX, event.clientY);
    slice.hover(target?.index, target?.group);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      end();
      slice.cancel();
    }
  };
  const onUp = () => {
    end();
    slice.drop();
  };
  const onCancel = () => {
    end();
    slice.cancel();
  };
  const end = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('keydown', onKey);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
  document.addEventListener('keydown', onKey);
}

/**
 * Pointer handlers that turn a header cell into a drag source for column
 * reordering. One gesture lives across renders: the header re-renders as
 * the column moves, so the origin of the press cannot live in the
 * handlers of one render. The cell only detects the drag; it is followed on
 * the document, because React moves the cell in the DOM as its column
 * changes place, and a moved element loses its pointer capture. The click
 * that ends a drag is swallowed so the header's own click handlers (sorting)
 * never see it.
 */
export function createHeaderDrag<TRow>(
  slice: IColumnMoveSlice
): (context: IHeaderContext<TRow>) => HTMLAttributes<HTMLDivElement> {
  let origin: { readonly x: number; readonly y: number } | null = null;
  let endsADrag = false;
  return context => {
    if (slice.reasonAgainst(context.column.id) !== undefined) {
      return {};
    }
    return {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        endsADrag = false;
        const onControl =
          event.target instanceof Element && event.target.closest(CONTROL_SELECTOR) !== null;
        if (event.button !== 0 || onControl) {
          return;
        }
        origin = { x: event.clientX, y: event.clientY };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (origin === null || Math.abs(event.clientX - origin.x) < DRAG_THRESHOLD_PX) {
          return;
        }
        origin = null;
        slice.begin(context.column.id);
        if (slice.drag !== null) {
          endsADrag = true;
          follow(context, slice);
        }
      },
      onPointerUp: () => {
        origin = null;
      },
      onClickCapture: event => {
        if (endsADrag) {
          event.stopPropagation();
          endsADrag = false;
        }
      },
    };
  };
}
