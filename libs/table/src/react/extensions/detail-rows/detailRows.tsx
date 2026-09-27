import type { ComponentType, MouseEvent } from 'react';

import { columnTitle } from '../../../core/columns/column';
import type { IExtensionInstance, ITableExtension } from '../../../core/kernel/extension';
import type { IDetailRowsOptions, IDetailRowsSlice } from '../../../extensions/detail-rows/core';
import { detailRows as detailRowsCore } from '../../../extensions/detail-rows/core';
import type { IColumn, IRowContext } from '../../column';
import type { IViewContributions } from '../../slots';
import { detailRowFor } from './DetailRow';
import { DetailToggleCell } from './DetailToggleCell';

export interface IDetailRowsViewOptions<TRow> extends IDetailRowsOptions<TRow> {
  /** What an open row shows underneath; it receives the row context and re-renders with the row. */
  readonly detail: ComponentType<IRowContext<TRow>>;
}

function detailView<TRow>(
  slice: IDetailRowsSlice,
  options: IDetailRowsViewOptions<TRow>
): IViewContributions<TRow> {
  const rowGesture = (rowKey: string) => (event: MouseEvent<HTMLDivElement>) => {
    if (slice.reasonAgainst(rowKey) === undefined || slice.isExpanded(rowKey)) {
      event.preventDefault();
      slice.toggle(rowKey);
    }
  };
  return {
    'row.after': detailRowFor(options.detail),
    'cell.props': [
      {
        id: 'detailRows.open',
        props: ({ table, column, rowKey }) => {
          if (slice.expandOn === 'none' || table.columns.isService(column.id)) {
            return {};
          }
          return slice.expandOn === 'click'
            ? { onClick: rowGesture(rowKey) }
            : { onDoubleClick: rowGesture(rowKey) };
        },
      },
    ],
  };
}

/** Master / detail: an arrow column, a detail block under open rows, and →/←/Enter on the arrow. */
export function detailRows<TRow = never>(
  options: IDetailRowsViewOptions<TRow>
): ITableExtension<TRow, 'detailRows', IDetailRowsSlice> {
  const core = detailRowsCore<TRow>(options);
  return {
    ...core,
    create(kernel): IExtensionInstance<TRow, IDetailRowsSlice> {
      const instance = core.create(kernel);
      const columns = instance.columns?.map((column): IColumn<TRow> => ({
        ...column,
        title: columnTitle(column),
        cell: DetailToggleCell,
      }));
      return {
        ...instance,
        columns,
        view: detailView(instance.slice, options) as Readonly<Record<string, unknown>>,
      };
    },
  };
}
