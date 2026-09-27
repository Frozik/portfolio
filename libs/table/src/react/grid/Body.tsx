import { observer } from 'mobx-react-lite';

import { useTableContext } from '../context';
import { gridViewOf } from './gridViewOf';
import { Row } from './Row';

export const Body = observer(function Body<TRow>() {
  const { table } = useTableContext<TRow>();
  const view = gridViewOf(table);
  return (
    <div role="rowgroup" className="ft-body" style={{ height: view.scrollHeight }}>
      <div className="ft-rows" style={{ transform: `translateY(${view.rowsOffset}px)` }}>
        {view.renderedRows.map(rendered => (
          <Row
            key={
              rendered.row.kind === 'leaf' ? rendered.key : `${rendered.row.kind}:${rendered.index}`
            }
            rendered={rendered}
          />
        ))}
      </div>
    </div>
  );
});
