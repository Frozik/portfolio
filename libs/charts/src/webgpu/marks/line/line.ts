import { withPainter } from '../../../core/series/mark';
import { LINE_MARK } from '../../../marks/line/core';
import { WEBGPU_BACKEND } from '../../painter';
import { linePainter } from './painter';

/** The line mark as WebGPU draws it. */
export const line = withPainter(LINE_MARK, WEBGPU_BACKEND, linePainter);
