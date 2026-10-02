import type { ICrosshairSlice } from '../../../core/frame/crosshair';
import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import { PAINT_BAND } from '../../../core/stage/backend';
import type { ICrosshairOptions } from '../../../extensions/crosshair/core';
import { crosshairCore } from '../../../extensions/crosshair/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { crosshairPainter } from './painter';

/** The crosshair with its labels on the 2D canvas, above everything else (§7.1). */
export function crosshair<TX>(
  options: ICrosshairOptions = {}
): IChartExtension<TX, 'crosshair', ICrosshairSlice<TX>> {
  return withPaint(crosshairCore<TX>(options), slice => [
    {
      id: 'crosshair',
      backend: CANVAS2D_BACKEND,
      band: PAINT_BAND.crosshair,
      painter: crosshairPainter(slice),
    },
  ]);
}
