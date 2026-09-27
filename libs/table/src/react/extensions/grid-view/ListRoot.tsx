import { observer } from 'mobx-react-lite';
import { useRef } from 'react';

import { columnText } from '../../../core/columns/column';
import type { TDisplayRow } from '../../../core/rows/display-row';
import { useTableContext } from '../../context';
import { gridViewOf } from '../../grid/gridViewOf';
import { useViewportSync } from '../../grid/useViewportSync';
import type { IViewContext } from '../../slots';

function Card<TRow>({ displayRow }: { readonly displayRow: TDisplayRow<TRow> }) {
  const { table, translations } = useTableContext<TRow>();
  if (displayRow.kind === 'group') {
    return <div className="ft-card ft-card-group">{displayRow.group.title}</div>;
  }
  if (displayRow.kind !== 'leaf') {
    return (
      <div className="ft-card ft-card-muted">
        {displayRow.kind === 'failed' ? translations.loadFailed : translations.loading}
      </div>
    );
  }
  const [title, ...rest] = table.columns.visible.filter(
    layout => !table.columns.isService(layout.id)
  );
  return (
    <div className="ft-card">
      {title !== undefined && (
        <div className="ft-card-title">{columnText(title.definition, displayRow.row)}</div>
      )}
      <dl className="ft-card-fields">
        {rest.map(layout => (
          <div key={layout.id} className="ft-card-field">
            <dt>
              {typeof layout.definition.title === 'string'
                ? layout.definition.title
                : layout.definition.title.text}
            </dt>
            <dd>{columnText(layout.definition, displayRow.row)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The same rows as cards: a second representation over the kernel's display rows and the grid view's virtual window. */
export const ListRoot = observer(function ListRoot<TRow>({ table }: IViewContext<TRow>) {
  const view = gridViewOf(table);
  const scrollRef = useRef<HTMLDivElement>(null);
  useViewportSync(scrollRef, view);
  return (
    <div
      ref={scrollRef}
      role="list"
      className="ft-scroll ft-list"
      aria-busy={table.rows.rowCount === undefined}
    >
      <div className="ft-body" style={{ height: view.scrollHeight }}>
        <div className="ft-rows" style={{ transform: `translateY(${view.rowsOffset}px)` }}>
          {view.renderedRows.map(rendered => (
            <div
              key={
                rendered.row.kind === 'leaf'
                  ? rendered.key
                  : `${rendered.row.kind}:${rendered.index}`
              }
              role="listitem"
              style={{ height: rendered.height }}
            >
              <Card displayRow={rendered.row} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
