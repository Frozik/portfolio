import { observer } from 'mobx-react-lite';
import type { MouseEvent } from 'react';
import { useEffect, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { assert } from '@frozik/utils/assert/assert';

import type { IGroupRow } from '../../../core/rows/display-row';
import type { IGroupingSlice } from '../../../extensions/grouping/core';
import type { IRowContext } from '../../column';
import { useTableContext } from '../../context';
import { positionAttributes } from '../../grid/cellAttributes';
import { gridViewOf } from '../../grid/gridViewOf';
import { isSpacer, rowTracks } from '../../grid/template';

const ARROW_EXPANDED = '▾';
const ARROW_COLLAPSED = '▸';

function Expander<TRow>({
  group,
  slice,
}: {
  readonly group: IGroupRow<TRow>;
  readonly slice: IGroupingSlice<TRow>;
}) {
  const { translations } = useTableContext<TRow>();
  const handleClick = useEventCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    slice.toggle(group.path);
  });
  if (group.columnId === undefined) {
    return null;
  }
  return (
    <button
      type="button"
      className="ft-icon-button ft-group-expander"
      aria-expanded={group.expanded}
      aria-label={group.expanded ? translations.collapseGroup : translations.expandGroup}
      tabIndex={-1}
      onClick={handleClick}
    >
      {group.expanded ? ARROW_EXPANDED : ARROW_COLLAPSED}
    </button>
  );
}

function aggregateText<TRow>(context: IRowContext<TRow>, columnId: string, value: unknown): string {
  const column = context.table.columns.byId.get(columnId);
  if (value === undefined || column === undefined) {
    return '';
  }
  return column.aggregate === 'count' || column.format === undefined
    ? String(value)
    : column.format(
        value,
        context.displayRow.kind === 'group'
          ? context.displayRow.group.rows[0]
          : (undefined as never)
      );
}

/** A group or totals row: full-width with `display: 'row'`, cell by cell with `display: 'column'`. */
export const GroupRow = observer(function GroupRow<TRow>(context: IRowContext<TRow>) {
  const { table, displayRow } = context;
  const slice = table.extension<IGroupingSlice<TRow>>('grouping');
  assert(
    slice !== undefined && displayRow.kind === 'group',
    'GroupRow renders group rows of the grouping extension'
  );
  const { group } = displayRow;
  const focused = table.focus.cell?.rowKey === group.key;
  const elementRef = useRef<HTMLDivElement>(null);
  const handleClick = useEventCallback(() => {
    const first = table.columns.visible[0];
    if (first !== undefined) {
      table.focus.focusCell(group.key, first.id);
    }
  });
  const handleDoubleClick = useEventCallback(() => {
    if (group.columnId !== undefined) {
      slice.toggle(group.path);
    }
  });

  useEffect(() => {
    const element = elementRef.current;
    if (focused && element !== null && !element.contains(document.activeElement)) {
      element.focus({ preventScroll: true });
    }
  }, [focused]);

  const count = slice.showCount && group.columnId !== undefined ? ` (${group.count})` : '';
  const shared = {
    ref: elementRef,
    tabIndex: focused ? 0 : -1,
    'aria-expanded': group.columnId === undefined ? undefined : group.expanded,
    'aria-level': group.level + 1,
    'data-focused': focused ? '' : undefined,
    'data-level': group.level,
    'data-totals': group.columnId === undefined ? '' : undefined,
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
  } as const;

  if (slice.display === 'row') {
    const summary = Object.entries(group.aggregates)
      .map(([columnId, value]) => {
        const column = table.columns.byId.get(columnId);
        const text = aggregateText(context, columnId, value);
        return column === undefined || text === ''
          ? ''
          : `${typeof column.title === 'string' ? column.title : column.title.text}: ${text}`;
      })
      .filter(text => text !== '')
      .join(' · ');
    return (
      <div role="gridcell" className="ft-cell ft-group-cell" {...shared}>
        <Expander group={group} slice={slice} />
        <span className="ft-group-title">
          {group.title}
          {count}
        </span>
        {summary !== '' && <span className="ft-group-summary">{summary}</span>}
      </div>
    );
  }

  const window = gridViewOf(table).columns;
  const firstId = window.columns.find(layout => !table.columns.isService(layout.id))?.id;
  return rowTracks(window).map(track => {
    if (isSpacer(track)) {
      return <div key={`spacer-${track.spacer}`} className="ft-spacer" aria-hidden />;
    }
    const position = positionAttributes(track, window.columns);
    const isFirst = track.id === firstId;
    return (
      <div
        key={track.id}
        role="gridcell"
        className="ft-cell ft-group-cell"
        {...position}
        {...(isFirst ? shared : {})}
        style={position.style}
      >
        {isFirst ? (
          <>
            <Expander group={group} slice={slice} />
            <span className="ft-group-title">
              {group.title}
              {count}
            </span>
          </>
        ) : (
          aggregateText(context, track.id, group.aggregates[track.id])
        )}
      </div>
    );
  });
});
