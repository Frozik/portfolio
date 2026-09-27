import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { cn } from '@frozik/components/components/cn';

import type { TableModel } from '../core/table-model';
import type { IRowContext, TCellSpecResolver } from './column';
import type { ITableContextValue } from './context';
import { TableContextProvider } from './context';
import { GridRoot } from './grid/GridRoot';
import { gridViewOf } from './grid/gridViewOf';
import { resolveSlots } from './slots';
import { getTableTranslations } from './translations/translations';
import type { ITableTranslations } from './translations/types';

const DEFAULT_LOCALE = 'en';

function TableComponent<TRow>({
  model,
  className,
  theme = 'auto',
  density = 'normal',
  locale = DEFAULT_LOCALE,
  numberLocale = locale,
  translations,
  emptyState,
  notReadyState,
  hoverHighlight = true,
  focusable = true,
  frame = true,
  rowClass,
  cellSpec,
}: {
  readonly model: TableModel<TRow, unknown>;
  readonly className?: string;
  readonly theme?: 'auto' | 'light' | 'dark';
  readonly density?: 'normal' | 'compact';
  readonly locale?: string;
  /** How numbers are written in cells and read in filters, when that differs from the UI locale. */
  readonly numberLocale?: string;
  readonly translations?: Partial<ITableTranslations>;
  readonly emptyState?: ReactNode;
  readonly notReadyState?: ReactNode;
  readonly hoverHighlight?: boolean;
  /** Whether clicking a cell focuses it (keyboard navigation, focus ring); off for a passive list. */
  readonly focusable?: boolean;
  /** Border and rounded corners around the grid; off when the table fills a framed container of its own. */
  readonly frame?: boolean;
  readonly rowClass?: (context: IRowContext<TRow>) => string | undefined;
  /** Per-cell overrides of the column (kind, format, editor, …) for tables whose value kind depends on the row. */
  readonly cellSpec?: TCellSpecResolver<NoInfer<TRow>>;
}) {
  const view = gridViewOf(model);
  const slots = useMemo(() => resolveSlots(model), [model]);
  const resolvedTranslations = useMemo(
    () => ({ ...getTableTranslations(locale), ...translations }),
    [locale, translations]
  );
  const value = useMemo<ITableContextValue<TRow>>(
    () => ({
      table: model,
      slots,
      translations: resolvedTranslations,
      locale,
      numberLocale,
      hoverHighlight,
      focusable,
      rowClass,
      cellSpec,
      emptyState,
      notReadyState,
    }),
    [
      model,
      slots,
      resolvedTranslations,
      locale,
      numberLocale,
      hoverHighlight,
      focusable,
      rowClass,
      cellSpec,
      emptyState,
      notReadyState,
    ]
  );
  const toolbar = slots.list('toolbar');
  const floating = slots.list('floating');
  const Root = slots.single('root');
  return (
    <TableContextProvider value={value}>
      <div
        className={cn('ft', className)}
        data-table-theme={theme}
        data-density={density}
        data-layout={view.layout}
        data-frame={frame ? undefined : 'none'}
        data-scrolled-x={view.scrolledX ? '' : undefined}
      >
        {toolbar.length > 0 && (
          <div className="ft-toolbar">
            {toolbar.map(part => (
              <part.render key={part.id} table={model} />
            ))}
          </div>
        )}
        {Root === undefined ? <GridRoot /> : <Root table={model} />}
        {floating.map(part => (
          <part.render key={part.id} table={model} />
        ))}
      </div>
    </TableContextProvider>
  );
}

/** `observer` erases the type parameter of a generic component; the cast gives it back so `cellSpec` and `rowClass` see the row type of `model`. */
export const Table = observer(TableComponent) as typeof TableComponent;
