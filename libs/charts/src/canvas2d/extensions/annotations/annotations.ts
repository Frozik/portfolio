import { requiredTicks } from '../../../core/frame/required-ticks';
import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import { PAINT_BAND } from '../../../core/stage/backend';
import type { IAnnotationsOptions, IAnnotationsSlice } from '../../../extensions/annotations/core';
import { annotationsCore } from '../../../extensions/annotations/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { annotationsPainter } from './painter';

/** Levels across a pane and event marks on the X axis, drawn on the 2D canvas with their labels (§7.1). */
export function annotations<TX>(
  options: IAnnotationsOptions<TX> = {}
): IChartExtension<TX, 'annotations', IAnnotationsSlice<TX>> {
  return withPaint(annotationsCore<TX>(options), (slice, kernel) => [
    {
      id: 'annotations',
      backend: CANVAS2D_BACKEND,
      band: PAINT_BAND.annotation,
      painter: annotationsPainter(slice, requiredTicks(kernel)),
    },
  ]);
}
