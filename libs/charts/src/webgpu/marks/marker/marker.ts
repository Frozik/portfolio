import { withPainter } from '../../../core/series/mark';
import { MARKER_MARK } from '../../../marks/marker/core';
import { WEBGPU_BACKEND } from '../../painter';
import { markerPainter } from './painter';

/** The marker mark as WebGPU draws it. */
export const marker = withPainter(MARKER_MARK, WEBGPU_BACKEND, markerPainter);
