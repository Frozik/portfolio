import type { ITableExtension } from '../../../core/kernel/extension';
import type { IGridViewOptions } from '../../../extensions/grid-view/core';
import { gridView } from '../../../extensions/grid-view/core';
import type { GridViewSlice } from '../../../extensions/grid-view/core';
import { withView } from '../withView';
import { ListRoot } from './ListRoot';

const CARD_HEIGHT = 96;

/** A card list instead of the grid: the same kernel, slices and slots, another root. A prototype of a second view. */
export function listView<TRow = never>(
  options: IGridViewOptions<TRow> = {}
): ITableExtension<TRow, 'gridView', GridViewSlice<TRow>> {
  return withView(gridView<TRow>({ rowHeight: CARD_HEIGHT, header: false, ...options }), () => ({
    root: ListRoot,
  }));
}
