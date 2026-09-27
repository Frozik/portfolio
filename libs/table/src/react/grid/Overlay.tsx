import { observer } from 'mobx-react-lite';

import { useTableContext } from '../context';

export const Overlay = observer(function Overlay<TRow>() {
  const { table, slots, translations, emptyState, notReadyState } = useTableContext<TRow>();
  const Custom = slots.single('body.overlay');
  if (Custom !== undefined) {
    return <Custom table={table} />;
  }
  if (!table.ready) {
    return <div className="ft-overlay">{notReadyState ?? translations.notReady}</div>;
  }
  const count = table.rows.rowCount;
  if (count === undefined) {
    return <div className="ft-overlay">{translations.loading}</div>;
  }
  if (count === 0) {
    return <div className="ft-overlay">{emptyState ?? translations.empty}</div>;
  }
  return null;
});
