import { gridOnCanvas } from '../../canvas2d/extensions/grid/contribution';
import type { IChartExtension } from '../../core/kernel/extension';
import { withPaint } from '../../core/kernel/with-paint';
import type { IGridSlice } from '../../extensions/grid/core';
import { gridCore } from '../../extensions/grid/core';
import { gridOnWebGpu } from '../../webgpu/extensions/grid/contribution';

/** Dashed lines under the series, one per tick, drawn by the bottom backend of the stage (§7.1). */
export function grid<TX>(): IChartExtension<TX, 'grid', IGridSlice<TX>> {
  return withPaint(gridCore<TX>(), slice => [gridOnWebGpu(slice), gridOnCanvas(slice)]);
}
