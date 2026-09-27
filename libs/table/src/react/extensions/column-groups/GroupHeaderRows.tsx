import { observer } from 'mobx-react-lite';
import type { CSSProperties } from 'react';

import type { IColumnGroupsSlice, IGroupHeaderSpan } from '../../../extensions/column-groups/core';
import type { IGroupHeaderContext } from '../../column';
import { useTableContext } from '../../context';
import { gridViewOf } from '../../grid/gridViewOf';
import type { TTrack } from '../../grid/template';
import { isSpacer, rowTracks } from '../../grid/template';
import type { IViewContext } from '../../slots';

interface IGroupCell<TRow> {
  readonly key: string;
  readonly span: IGroupHeaderSpan | undefined;
  readonly tracks: number;
  readonly first: TTrack<TRow> | undefined;
}

/** Groups the rendered tracks of one level into cells; a spacer joins the cell of the group around it. */
function cellsOf<TRow>(
  spans: readonly IGroupHeaderSpan[],
  tracks: readonly TTrack<TRow>[]
): readonly IGroupCell<TRow>[] {
  const spanByColumn = new Map(
    spans.flatMap(span => span.columnIds.map(id => [id, span] as const))
  );
  const cells: IGroupCell<TRow>[] = [];
  for (const track of tracks) {
    const span = isSpacer(track) ? undefined : spanByColumn.get(track.id);
    const last = cells.at(-1);
    const joins =
      last !== undefined &&
      (isSpacer(track)
        ? last.span?.group !== undefined
        : last.span === span && span?.group !== undefined);
    if (joins) {
      cells[cells.length - 1] = { ...last, tracks: last.tracks + 1 };
      continue;
    }
    cells.push({
      key: isSpacer(track) ? `spacer-${track.spacer}` : (span?.group?.id ?? track.id),
      span: isSpacer(track) ? undefined : span,
      tracks: 1,
      first: track,
    });
  }
  return cells;
}

export const GroupHeaderRows = observer(function GroupHeaderRows<TRow>({
  table,
}: IViewContext<TRow>) {
  const slice = table.extension<IColumnGroupsSlice>('columnGroups');
  const { slots } = useTableContext<TRow>();
  const view = gridViewOf(table);
  if (slice === undefined || slice.depth === 0) {
    return null;
  }
  const tracks = rowTracks(view.columns);
  const GroupHeader = slots.single('header.group');
  return Array.from({ length: slice.depth }, (_, level) => (
    <div
      key={level}
      role="row"
      aria-rowindex={level + 1}
      className="ft-row ft-header-row ft-group-row"
    >
      {cellsOf(slice.level(level), tracks).map(cell => {
        const group = cell.span?.group;
        const first = cell.first;
        const sticky = first !== undefined && !isSpacer(first) ? first.stickyOffset : undefined;
        const section = first !== undefined && !isSpacer(first) ? first.section : undefined;
        const style: CSSProperties = {
          gridColumn: `span ${cell.tracks}`,
          ...(sticky === undefined ? {} : { '--ft-sticky': `${sticky}px` }),
        } as CSSProperties;
        if (group === undefined) {
          return (
            <div
              key={cell.key}
              className="ft-header-cell"
              aria-hidden
              style={style}
              data-section={section}
            />
          );
        }
        const context: IGroupHeaderContext<TRow> = { table, group };
        return (
          <div
            key={cell.key}
            role="columnheader"
            className="ft-header-cell"
            data-group={group.id}
            data-section={section}
            style={style}
          >
            {GroupHeader !== undefined ? (
              <GroupHeader {...context} />
            ) : typeof group.title === 'string' ? (
              <span className="ft-header-title">{group.title}</span>
            ) : (
              <span className="ft-header-title">{group.title.text}</span>
            )}
          </div>
        );
      })}
    </div>
  ));
});
