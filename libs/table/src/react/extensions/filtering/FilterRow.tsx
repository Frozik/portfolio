import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IColumnLayout } from '../../../core/columns/columns-model';
import type { TFilterModel } from '../../../extensions/filtering/model';
import type { IColumn } from '../../column';
import { useTableContext } from '../../context';
import { positionAttributes } from '../../grid/cellAttributes';
import { gridViewOf } from '../../grid/gridViewOf';
import { isSpacer, rowTracks } from '../../grid/template';
import type { IViewContext } from '../../slots';
import { fieldFor } from './fields/fieldFor';
import type { IFilterFieldContext } from './filtering-column';
import { useFiltering } from './filtering-context';
import { anchorOf } from './ui-state';

const FilterCell = observer(function FilterCell<TRow>({
  layout,
  columns,
}: {
  readonly layout: IColumnLayout<TRow>;
  readonly columns: readonly IColumnLayout<TRow>[];
}) {
  const { table } = useTableContext<TRow>();
  const { slice, ui } = useFiltering();
  const column = layout.definition as IColumn<TRow>;
  const spec = slice.specOf(column.id);
  const model = slice.modelOf(column.id);
  const set = useEventCallback((next: TFilterModel | null) => slice.set(column.id, next));
  const openEditor = useEventCallback((anchor: HTMLElement) =>
    ui.toggle(anchorOf(anchor, column.id))
  );
  const context = useMemo<IFilterFieldContext<TRow> | undefined>(
    () =>
      spec === undefined ? undefined : { table, column, layout, spec, model, set, openEditor },
    [table, column, layout, spec, model, set, openEditor]
  );
  const Field =
    column.filterRow === false || context === undefined
      ? undefined
      : (column.filterRow ?? fieldFor<TRow>(context.spec.kind));
  const position = positionAttributes(layout, columns);
  return (
    <div
      className="ft-filter-cell"
      {...position}
      style={position.style}
      data-disabled={slice.reasonAgainst(column.id) === undefined ? undefined : ''}
    >
      {Field !== undefined &&
        context !== undefined &&
        slice.reasonAgainst(column.id) === undefined && <Field {...context} />}
    </div>
  );
});

/** One field per visible column under the header; hidden until `filterRow` is on. */
export const FilterRow = observer(function FilterRow<TRow>(_: IViewContext<TRow>) {
  const { table } = useTableContext<TRow>();
  const { slice } = useFiltering();
  const window = gridViewOf(table).columns;
  if (!slice.filterRow) {
    return null;
  }
  return (
    <div role="row" className="ft-row ft-filter-row">
      {rowTracks(window).map(track =>
        isSpacer(track) ? (
          <div key={`spacer-${track.spacer}`} className="ft-spacer" aria-hidden />
        ) : (
          <FilterCell key={track.id} layout={track} columns={window.columns} />
        )
      )}
    </div>
  );
});
