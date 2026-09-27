import { observer } from 'mobx-react-lite';
import type { PointerEvent } from 'react';
import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { DEFAULT_MIN_COLUMN_WIDTH } from '../../../core/columns/column-widths';
import type { IColumnResizeSlice } from '../../../extensions/column-resize/core';
import type { IHeaderContext } from '../../column';
import { useTableContext } from '../../context';

export const ResizeHandle = observer(function ResizeHandle<TRow>({
  table,
  column,
  layout,
}: IHeaderContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const slice = table.extension<IColumnResizeSlice>('columnResize');
  const start = useRef<{ readonly x: number; readonly width: number } | null>(null);

  const handlePointerDown = useEventCallback((event: PointerEvent<HTMLDivElement>) => {
    if (slice === undefined || slice.reasonAgainst(column.id) !== undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width: layout.width };
    slice.beginResize(column.id);
  });

  const handlePointerMove = useEventCallback((event: PointerEvent<HTMLDivElement>) => {
    if (start.current === null || slice === undefined) {
      return;
    }
    const minWidth = column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
    slice.resize(
      column.id,
      Math.max(minWidth, start.current.width + event.clientX - start.current.x)
    );
  });

  const handlePointerUp = useEventCallback(() => {
    start.current = null;
    slice?.endResize();
  });

  const handleDoubleClick = useEventCallback((event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    slice?.autoSize([column.id], { cap: false });
  });

  if (slice === undefined || slice.reasonAgainst(column.id) !== undefined) {
    return null;
  }
  return (
    <div
      className="ft-resize-handle"
      role="separator"
      tabIndex={-1}
      aria-orientation="vertical"
      aria-label={translations.resizeColumn}
      data-resizing={slice.resizing === column.id ? '' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onClick={event => event.stopPropagation()}
    />
  );
});
