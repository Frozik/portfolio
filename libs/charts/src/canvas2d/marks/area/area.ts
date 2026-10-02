import { withPainter } from '../../../core/series/mark';
import { AREA_MARK } from '../../../marks/area/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { areaCanvasPainter } from './painter';

/** The area mark as the 2D canvas draws it. */
export const area = withPainter(AREA_MARK, CANVAS2D_BACKEND, areaCanvasPainter);
