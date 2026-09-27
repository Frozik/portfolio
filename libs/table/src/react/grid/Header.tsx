import { observer } from 'mobx-react-lite';
import { useRef } from 'react';

import { useTableContext } from '../context';
import { gridViewOf } from './gridViewOf';
import { HeaderCell } from './HeaderCell';
import { isSpacer, rowTracks } from './template';
import { useRowMeasure } from './useRowMeasure';

export const Header = observer(function Header<TRow>() {
  const { table, slots } = useTableContext<TRow>();
  const view = gridViewOf(table);
  const window = view.columns;
  const Before = slots.single('header.row.before');
  const After = slots.single('header.row.after');
  const headerRef = useRef<HTMLDivElement>(null);
  useRowMeasure(headerRef, true, view.measureHeader);
  return (
    <div ref={headerRef} role="rowgroup" className="ft-header">
      {Before !== undefined && <Before table={table} />}
      <div role="row" aria-rowindex={1} className="ft-row ft-header-row">
        {rowTracks(window).map(track =>
          isSpacer(track) ? (
            <div key={`spacer-${track.spacer}`} className="ft-spacer" aria-hidden />
          ) : (
            <HeaderCell key={track.id} layout={track} columns={window.columns} />
          )
        )}
      </div>
      {After !== undefined && <After table={table} />}
    </div>
  );
});
