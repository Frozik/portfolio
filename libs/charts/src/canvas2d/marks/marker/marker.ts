import { withPainter } from '../../../core/series/mark';
import { MARKER_MARK } from '../../../marks/marker/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { markerCanvasPainter } from './painter';

/** The marker mark as the 2D canvas draws it. */
export const marker = withPainter(MARKER_MARK, CANVAS2D_BACKEND, markerCanvasPainter);
