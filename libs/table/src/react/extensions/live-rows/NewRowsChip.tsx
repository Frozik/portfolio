import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import { isLiveRowSource } from '../../../core/rows/log-contracts';
import { useTableContext } from '../../context';
import { gridViewOf } from '../../grid/gridViewOf';
import type { IViewContext } from '../../slots';

/** "N new rows ↑": rows a log held back while the user was away from the fresh edge; click scrolls there and lets them in. */
export const NewRowsChip = observer(function NewRowsChip<TRow>({ table }: IViewContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const source = table.rows;
  const handleClick = useEventCallback(() => {
    if (!isLiveRowSource(source)) {
      return;
    }
    source.flush();
    const view = gridViewOf(table);
    view.scrollToRow(
      source.direction === 'backward' ? 0 : Math.max(0, (table.rows.rowCount ?? 1) - 1)
    );
  });
  if (!isLiveRowSource(source)) {
    return null;
  }
  if (source.liveStopped) {
    return <span className="ft-chip ft-chip-muted">{translations.liveStopped}</span>;
  }
  if (source.buffered === 0) {
    return null;
  }
  return (
    <button type="button" className="ft-chip ft-chip-accent" onClick={handleClick}>
      {translations.newRows(source.buffered)} {source.direction === 'backward' ? '↑' : '↓'}
    </button>
  );
});
