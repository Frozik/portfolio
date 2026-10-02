import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import { PAINT_BAND } from '../../../core/stage/backend';
import type { ILegendSlice } from '../../../extensions/legend/core';
import { legendCore } from '../../../extensions/legend/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { legendPainter } from './painter';

/** The names of the series and their values under the pointer, written in the corner of every pane (§7.1). */
export function legend<TX>(): IChartExtension<TX, 'legend', ILegendSlice<TX>> {
  return withPaint(legendCore<TX>(), slice => [
    {
      id: 'legend',
      backend: CANVAS2D_BACKEND,
      band: PAINT_BAND.axes,
      painter: legendPainter(slice),
    },
  ]);
}
