import { cutsOnCanvas } from '../../canvas2d/extensions/cuts/contribution';
import type { IChartExtension } from '../../core/kernel/extension';
import { withPaint } from '../../core/kernel/with-paint';
import type { ICutsSlice } from '../../extensions/cuts/core';
import { cutsCore } from '../../extensions/cuts/core';
import { cutsOnWebGpu } from '../../webgpu/extensions/cuts/contribution';

/** A dashed strip under the series at every cut of the axis in view, drawn by the bottom backend of the stage (sessions §6). */
export function cuts<TX>(): IChartExtension<TX, 'cuts', ICutsSlice<TX>> {
  return withPaint(cutsCore<TX>(), slice => [cutsOnWebGpu(slice), cutsOnCanvas(slice)]);
}
