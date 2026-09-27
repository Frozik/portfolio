import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { assert } from '@frozik/utils/assert/assert';

import type { TableModel } from '../core/table-model';
import type { IRowContext, TCellSpecResolver } from './column';
import type { IResolvedSlots } from './slots';
import type { ITableTranslations } from './translations/types';

export interface ITableContextValue<TRow> {
  readonly table: TableModel<TRow, unknown>;
  readonly slots: IResolvedSlots<TRow>;
  readonly translations: ITableTranslations;
  readonly locale: string;
  /** The locale numbers are written and parsed in; the UI locale unless the application formats numbers differently. */
  readonly numberLocale: string;
  readonly hoverHighlight: boolean;
  /** Cells take the keyboard focus on click and show the focus ring; off for a passive, read-only list. */
  readonly focusable: boolean;
  readonly cellSpec: TCellSpecResolver<TRow> | undefined;
  readonly rowClass: ((context: IRowContext<TRow>) => string | undefined) | undefined;
  readonly emptyState: ReactNode;
  readonly notReadyState: ReactNode;
}

/**
 * React contexts cannot carry a type parameter, so the value is stored erased
 * and re-typed by the hook: every consumer sits under one <Table>, whose row
 * type it shares.
 */
const TableContext = createContext<unknown>(undefined);

export const TableContextProvider = TableContext.Provider;

export function useTableContext<TRow>(): ITableContextValue<TRow> {
  const value = useContext(TableContext) as ITableContextValue<TRow> | undefined;
  assert(value !== undefined, 'useTableContext must be used inside <Table>');
  return value;
}
