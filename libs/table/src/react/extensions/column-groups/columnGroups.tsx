import type { ITableExtension } from '../../../core/kernel/extension';
import type {
  IColumnGroupsOptions,
  IColumnGroupsSlice,
} from '../../../extensions/column-groups/core';
import { columnGroups as columnGroupsCore } from '../../../extensions/column-groups/core';
import { withView } from '../withView';
import { GroupHeaderRows } from './GroupHeaderRows';

/** Grouped column headers: one extra header row per level, spanning the group's visible columns. */
export function columnGroups<TRow = never>(
  options: IColumnGroupsOptions
): ITableExtension<TRow, 'columnGroups', IColumnGroupsSlice> {
  return withView(columnGroupsCore<TRow>(options), () => ({
    'header.row.before': GroupHeaderRows,
  }));
}
