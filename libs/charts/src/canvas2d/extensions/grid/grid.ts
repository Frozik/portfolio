import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import type { IGridSlice } from '../../../extensions/grid/core';
import { gridCore } from '../../../extensions/grid/core';
import { gridOnCanvas } from './contribution';

/** Dashed lines under the series, one per tick, on the 2D canvas (§7.1). */
export function grid<TX>(): IChartExtension<TX, 'grid', IGridSlice<TX>> {
  return withPaint(gridCore<TX>(), slice => [gridOnCanvas(slice)]);
}
