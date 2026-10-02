import { withPainter } from '../../../core/series/mark';
import { CANDLE_MARK } from '../../../marks/candle/core';
import { WEBGPU_BACKEND } from '../../painter';
import { candlePainter } from './painter';

/** The candle mark as WebGPU draws it. */
export const candle = withPainter(CANDLE_MARK, WEBGPU_BACKEND, candlePainter);
