import { withPainter } from '../../../core/series/mark';
import { COLUMN_MARK } from '../../../marks/column/core';
import { WEBGPU_BACKEND } from '../../painter';
import { columnPainter } from './painter';

/** The column mark as WebGPU draws it. */
export const column = withPainter(COLUMN_MARK, WEBGPU_BACKEND, columnPainter);
