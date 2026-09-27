import type { ITableKernel } from '../../core/kernel/kernel';
import type { IMenuContext, TMenuItem } from '../../core/kernel/menu';
import type { IFilteringSlice } from './contracts';

/** Filter by the value under the pointer, clear the column, toggle the filter row, reset everything. */
export function filteringMenu<TRow>(
  slice: IFilteringSlice,
  kernel: ITableKernel<TRow, unknown>,
  { target, columnId, row }: IMenuContext<TRow>
): readonly TMenuItem[] {
  const filterable =
    columnId !== undefined && slice.reasonAgainst(columnId) === undefined ? columnId : undefined;
  const column = filterable === undefined ? undefined : kernel.columns.byId.get(filterable);
  const byValue =
    target === 'cell' && filterable !== undefined && column !== undefined && row !== undefined
      ? slice.filterFor(filterable, column.value(row))
      : undefined;
  return [
    ...(byValue === undefined || filterable === undefined
      ? []
      : [
          {
            id: 'filtering.byValue',
            label: 'menu.filter.byValue',
            section: 'filtering',
            run: () => void slice.set(filterable, byValue),
          },
        ]),
    ...(filterable === undefined
      ? []
      : [
          {
            id: 'filtering.clearColumn',
            label: 'menu.filter.clearColumn',
            section: 'filtering',
            disabled: slice.modelOf(filterable) === undefined,
            run: () => void slice.set(filterable, null),
          },
        ]),
    {
      id: 'filtering.filterRow',
      label: slice.filterRow ? 'menu.filter.hideRow' : 'menu.filter.showRow',
      section: 'filtering',
      run: () => slice.setFilterRow(!slice.filterRow),
    },
    {
      id: 'filtering.reset',
      label: 'menu.filter.reset',
      section: 'filtering',
      disabled: slice.activeCount === 0,
      run: () => void slice.clear(),
    },
  ];
}
