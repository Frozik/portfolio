import { assert } from '@frozik/utils/assert/assert';

import type { TableModel } from '../../core/table-model';
import type { GridViewSlice } from '../../extensions/grid-view/core';

export function gridViewOf<TRow>(table: TableModel<TRow, unknown>): GridViewSlice<TRow> {
  const view = table.extension<GridViewSlice<TRow>>('gridView');
  assert(view !== undefined, '<Table> needs the gridView() extension');
  return view;
}
