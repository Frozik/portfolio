import type { IColumnLayout } from '../../core/columns/columns-model';

export interface IColumnWindow<TRow> {
  readonly columns: readonly IColumnLayout<TRow>[];
  readonly leftSpacer: number;
  readonly rightSpacer: number;
}

/**
 * The columns worth rendering for a horizontal scroll position: every pinned
 * column plus the centre columns that intersect the viewport, with spacers
 * standing in for the skipped centre columns so the row keeps its full width.
 */
export function columnWindow<TRow>(
  visible: readonly IColumnLayout<TRow>[],
  scrollLeft: number,
  viewportWidth: number | undefined,
  overscan: number
): IColumnWindow<TRow> {
  const center = visible.filter(layout => layout.section === 'center');
  if (viewportWidth === undefined || center.length === 0) {
    return { columns: visible, leftSpacer: 0, rightSpacer: 0 };
  }
  const pinnedLeftWidth = visible
    .filter(layout => layout.section === 'left')
    .reduce((sum, layout) => sum + layout.width, 0);
  const pinnedRightWidth = visible
    .filter(layout => layout.section === 'right')
    .reduce((sum, layout) => sum + layout.width, 0);
  const from = scrollLeft + pinnedLeftWidth;
  const to = scrollLeft + viewportWidth - pinnedRightWidth;
  let first = center.findIndex(layout => layout.offset + layout.width > from);
  let last = center.findIndex(layout => layout.offset >= to);
  first = first === -1 ? center.length : first;
  last = last === -1 ? center.length : last;
  const start = Math.max(0, first - overscan);
  const end = Math.min(center.length, last + overscan);
  const rendered = new Set(center.slice(start, end).map(layout => layout.id));
  const leftSpacer = center.slice(0, start).reduce((sum, layout) => sum + layout.width, 0);
  const rightSpacer = center.slice(end).reduce((sum, layout) => sum + layout.width, 0);
  return {
    columns: visible.filter(layout => layout.section !== 'center' || rendered.has(layout.id)),
    leftSpacer,
    rightSpacer,
  };
}
