import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import { PAINT_BAND } from '../../../core/stage/backend';
import { loadingIndicatorCore } from '../../../extensions/loading-indicator/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { loadingIndicatorPainter } from './painter';

/** Bars along the bottom edge for what is loading and what failed (§7.1). */
export function loadingIndicator<TX>(): IChartExtension<TX, 'loadingIndicator', undefined> {
  return withPaint(loadingIndicatorCore<TX>(), () => [
    {
      id: 'loadingIndicator',
      backend: CANVAS2D_BACKEND,
      band: PAINT_BAND.annotation,
      painter: loadingIndicatorPainter<TX>(),
    },
  ]);
}
