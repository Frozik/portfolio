import { withPainter } from '../../../core/series/mark';
import { CANDLE_MARK } from '../../../marks/candle/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { candleCanvasPainter } from './painter';

/** The candle mark as the 2D canvas draws it. */
export const candle = withPainter(CANDLE_MARK, CANVAS2D_BACKEND, candleCanvasPainter);
