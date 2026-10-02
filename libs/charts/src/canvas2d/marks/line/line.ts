import { withPainter } from '../../../core/series/mark';
import { LINE_MARK } from '../../../marks/line/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { lineCanvasPainter } from './painter';

/** The line mark as the 2D canvas draws it. */
export const line = withPainter(LINE_MARK, CANVAS2D_BACKEND, lineCanvasPainter);
