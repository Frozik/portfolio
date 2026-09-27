import { observer } from 'mobx-react-lite';

import type { TDisplayRow } from '../../core/rows/display-row';
import { useTableContext } from '../context';
import { Cell } from './Cell';
import { gridViewOf } from './gridViewOf';
import { isSpacer, rowTracks } from './template';

export const PinnedRows = observer(function PinnedRows<TRow>({
  side,
  rows,
}: {
  readonly side: 'top' | 'bottom';
  readonly rows: readonly TDisplayRow<TRow>[];
}) {
  const { table, slots } = useTableContext<TRow>();
  const view = gridViewOf(table);
  const RowSlot = slots.single('row');
  if (rows.length === 0) {
    return null;
  }
  const window = view.columns;
  return (
    <div role="rowgroup" className="ft-pinned-rows" data-side={side}>
      {rows.map((displayRow, index) => (
        <div
          key={displayRow.key}
          role="row"
          className="ft-row ft-body-row"
          data-pinned={side}
          data-row-kind={displayRow.kind}
        >
          {displayRow.kind !== 'leaf' && RowSlot !== undefined && (
            <RowSlot table={table} displayRow={displayRow} rowIndex={index} />
          )}
          {displayRow.kind === 'leaf' &&
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
            )}
        </div>
      ))}
    </div>
  );
});
