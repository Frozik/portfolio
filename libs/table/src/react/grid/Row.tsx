import { observer } from 'mobx-react-lite';
import type { CSSProperties } from 'react';
import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '@frozik/components/components/cn';

import type { IColumnWindow } from '../../extensions/grid-view/column-window';
import type { IRenderedRow } from '../../extensions/grid-view/core';
import { SkeletonCell } from '../cells/SkeletonCell';
import type { IRowContext } from '../column';
import { useTableContext } from '../context';
import { Cell } from './Cell';
import { gridViewOf } from './gridViewOf';
import { isSpacer, rowTracks } from './template';
import { useRowMeasure } from './useRowMeasure';

function PlaceholderRow<TRow>({
  context,
  window,
}: {
  readonly context: IRowContext<TRow>;
  readonly window: IColumnWindow<TRow>;
}) {
  const { displayRow } = context;
  const { translations } = useTableContext<TRow>();
  if (displayRow.kind === 'group') {
    return <div className="ft-cell ft-group-title">{displayRow.group.title}</div>;
  }
  if (displayRow.kind === 'failed') {
    return <div className="ft-cell ft-cell-failed">{translations.loadFailed}</div>;
  }
  return rowTracks(window).map(track =>
    isSpacer(track) ? (
      <div key={`spacer-${track.spacer}`} className="ft-spacer" aria-hidden />
    ) : (
      <div key={track.id} className="ft-cell" data-section={track.section} aria-busy>
        <SkeletonCell />
      </div>
    )
  );
}

export const Row = observer(function Row<TRow>({
  rendered,
}: {
  readonly rendered: IRenderedRow<TRow>;
}) {
  const { table, slots, hoverHighlight, rowClass } = useTableContext<TRow>();
  const view = gridViewOf(table);
  const window = view.columns;
  const { row: displayRow, index } = rendered;
  const context: IRowContext<TRow> = { table, displayRow, rowIndex: index };
  const rowRef = useRef<HTMLDivElement>(null);
  const measure = useEventCallback((height: number) => view.measure(displayRow.key, height));
  useRowMeasure(rowRef, view.measuresRows && displayRow.kind === 'leaf', measure);
  const RowSlot = slots.single('row');
  const After = slots.single('row.after');
  const style: CSSProperties | undefined = view.measuresRows
    ? undefined
    : ({
        '--ft-row-height': `${rendered.height - table.rowExtent(displayRow.key)}px`,
      } as CSSProperties);
  return (
    <>
      <div
        ref={rowRef}
        role="row"
        aria-rowindex={index + 2}
        className={cn('ft-row ft-body-row', rowClass?.(context))}
        data-row-kind={displayRow.kind}
        data-hover={hoverHighlight && displayRow.kind === 'leaf' ? '' : undefined}
        style={style}
      >
        {displayRow.kind === 'leaf' ? (
          rowTracks(window).map(track =>
            isSpacer(track) ? (
              <div key={`spacer-${track.spacer}`} className="ft-spacer" aria-hidden />
            ) : (
              <Cell
                key={track.id}
                layout={track}
                columns={window.columns}
                row={displayRow.row}
                rowKey={displayRow.key}
                rowIndex={index}
              />
            )
          )
        ) : RowSlot !== undefined ? (
          <RowSlot {...context} />
        ) : (
          <PlaceholderRow context={context} window={window} />
        )}
      </div>
      {After !== undefined && displayRow.kind === 'leaf' && <After {...context} />}
    </>
  );
});
