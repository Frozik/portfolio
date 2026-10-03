import { untracked } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useMemo, useRef } from 'react';

import { cn } from '@frozik/components/components/cn';

import type { IColumnLayout } from '../../core/columns/columns-model';
import type { IColumn, IHeaderContext, INamedPart } from '../column';
import { resolve } from '../column';
import { useTableContext } from '../context';
import { mergeDecorations, mergeProps, positionAttributes } from './cellAttributes';
import { useSlideOnReorder } from './useSlideOnReorder';

function HeaderParts<TRow>({
  parts,
  context,
}: {
  readonly parts: readonly INamedPart<IHeaderContext<TRow>>[];
  readonly context: IHeaderContext<TRow>;
}) {
  return parts.map(part => (
    <span
      key={part.id}
      className="ft-header-part"
      data-part={part.id}
      data-hover-only={part.hoverOnly === true ? '' : undefined}
      data-active={part.active?.(context) === true ? '' : undefined}
    >
      <part.render {...context} />
    </span>
  ));
}

export const HeaderCell = observer(function HeaderCell<TRow>({
  layout,
  columns,
}: {
  readonly layout: IColumnLayout<TRow>;
  readonly columns: readonly IColumnLayout<TRow>[];
}) {
  const { table, slots } = useTableContext<TRow>();
  const ref = useRef<HTMLDivElement>(null);
  useSlideOnReorder(ref, layout.index);
  const column = layout.definition as IColumn<TRow>;
  const context = useMemo<IHeaderContext<TRow>>(
    () => ({ table, column, layout }),
    [table, column, layout]
  );
  const parts =
    column.parts === undefined
      ? slots.list('header.cell.parts')
      : column.parts(slots.list('header.cell.parts'), context);
  const visibleParts = parts.filter(part => column.overrides?.[part.id] !== false);
  const props = untracked(() => mergeProps(slots.list('header.cell.props'), context));
  const decoration = mergeDecorations([
    ...slots.list('header.cell.decorate').map(named => named.decorate(context)),
    resolve(column.headerDecorate, context),
  ]);
  const position = positionAttributes(layout, columns);
  const Custom = column.header ?? slots.single('header.cell');
  const title = column.title;
  return (
    <div
      ref={ref}
      role="columnheader"
      aria-colindex={layout.index + 1}
      {...props}
      {...position}
      {...decoration.data}
      {...decoration.aria}
      className={cn('ft-header-cell', decoration.className, props.className)}
      style={{ ...position.style, ...decoration.style, ...props.style }}
    >
      {Custom !== undefined ? (
        <Custom {...context} />
      ) : (
        <>
          {typeof title === 'string' ? (
            <span className="ft-header-title">{title}</span>
          ) : (
            <title.component {...context} />
          )}
          <HeaderParts parts={visibleParts} context={context} />
        </>
      )}
    </div>
  );
});
