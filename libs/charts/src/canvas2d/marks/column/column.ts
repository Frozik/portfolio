import { withPainter } from '../../../core/series/mark';
import { COLUMN_MARK } from '../../../marks/column/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { columnCanvasPainter } from './painter';

/** The column mark as the 2D canvas draws it. */
export const column = withPainter(COLUMN_MARK, CANVAS2D_BACKEND, columnCanvasPainter);
