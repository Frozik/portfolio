import { observer } from 'mobx-react-lite';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { TFocusMove } from '../../core/focus/focus-model';
import { useTableContext } from '../context';
import { Body } from './Body';
import { gridViewOf } from './gridViewOf';
import { Header } from './Header';
import { matchesKey } from './keyboard';
import { Overlay } from './Overlay';
import { PinnedRows } from './PinnedRows';
import { gridTemplate } from './template';
import { useViewportSync } from './useViewportSync';

const NAVIGATION: readonly (readonly [string, TFocusMove])[] = [
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['PageUp', 'pageUp'],
  ['PageDown', 'pageDown'],
  ['Home', 'rowStart'],
  ['End', 'rowEnd'],
  ['Mod+Home', 'home'],
  ['Mod+End', 'end'],
];

/** Fields inside the grid (filter row, editors) own their keys; the grid navigates only from cells. */
function isTextInput(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable)
  );
}

export const GridRoot = observer(function GridRoot<TRow>() {
  const { table } = useTableContext<TRow>();
  const view = gridViewOf(table);
  const scrollRef = useRef<HTMLDivElement>(null);
  useViewportSync(scrollRef, view);

  const revealFocus = useEventCallback(() => {
    const focused = table.focus.cell;
    if (focused === null) {
      return;
    }
    const rowIndex = table.rows.indexOf(focused.rowKey);
    if (rowIndex !== undefined) {
      view.scrollToRow(rowIndex);
    }
    const layout = table.columns.visibleById.get(focused.columnId);
    if (layout !== undefined) {
      view.scrollToColumn(layout);
    }
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (isTextInput(event.target)) {
      return;
    }
    for (const binding of table.keys) {
      if (binding.target === 'cell' && matchesKey(binding.key, event) && binding.run(table)) {
        event.preventDefault();
        revealFocus();
        return;
      }
    }
    const navigation = NAVIGATION.find(([key]) => matchesKey(key, event));
    if (navigation === undefined) {
      return;
    }
    event.preventDefault();
    const pageRows = Math.max(1, view.rowWindow.endIndex - view.rowWindow.startIndex - 1);
    table.focus.move(navigation[1], pageRows);
    revealFocus();
  });

  const headerHeight = !view.header
    ? '0px'
    : view.headerHeight === undefined
      ? 'var(--table-header-height)'
      : `${view.headerHeight}px`;
  const style = {
    '--ft-columns': gridTemplate(view.columns),
    '--ft-header-height': headerHeight,
    maxHeight:
      view.layout === 'content'
        ? `calc(${headerHeight} + ${view.contentRowsHeight}px + 2px)`
        : undefined,
  } as CSSProperties;

  const grouped =
    (table.extension<{ readonly groupBy: readonly string[] }>('grouping')?.groupBy.length ?? 0) > 0;
  return (
    <div
      ref={scrollRef}
      role={grouped ? 'treegrid' : 'grid'}
      className="ft-scroll"
      tabIndex={table.focus.cell === null ? 0 : -1}
      aria-rowcount={(table.rows.rowCount ?? -1) + 1}
      aria-colcount={table.columns.visible.length}
      aria-busy={table.rows.rowCount === undefined}
      onKeyDown={handleKeyDown}
      style={style}
    >
      {view.header && <Header />}
      <PinnedRows side="top" rows={table.pinnedTop} />
      <Body />
      <PinnedRows side="bottom" rows={table.pinnedBottom} />
      <Overlay />
    </div>
  );
});
