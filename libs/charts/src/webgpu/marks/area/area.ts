import { withPainter } from '../../../core/series/mark';
import { AREA_MARK } from '../../../marks/area/core';
import { WEBGPU_BACKEND } from '../../painter';
import { areaPainter } from './painter';

/** The area mark as WebGPU draws it. */
export const area = withPainter(AREA_MARK, WEBGPU_BACKEND, areaPainter);
