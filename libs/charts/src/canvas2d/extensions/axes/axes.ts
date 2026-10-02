import { requiredTicks } from '../../../core/frame/required-ticks';
import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import { PAINT_BAND } from '../../../core/stage/backend';
import { axesCore } from '../../../extensions/axes/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { axesPainter } from './painter';

/** Axis lines and tick labels, drawn on the 2D canvas: text is sharper there (§6.2). */
export function axes<TX>(): IChartExtension<TX, 'axes', undefined> {
  return withPaint(axesCore<TX>(), (_slice, kernel) => [
    {
      id: 'axes',
      backend: CANVAS2D_BACKEND,
      band: PAINT_BAND.axes,
      painter: axesPainter(requiredTicks(kernel)),
    },
  ]);
}
