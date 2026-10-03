import { floorPixelOf } from '../../../core/scale/scale-mapping';
import { columnOptionsOf } from '../../../marks/column/core';
import type { IMarkLayer, IWebGpuMarkPainter } from '../../painter';
import { canvasFractionOf } from '../../scale-uniforms';
import columnSource from './column.wgsl?raw';

export const columnPainter: IWebGpuMarkPainter = {
  markId: 'column',
  source: columnSource,
  vertexFunction: 'columnVertex',
  verticesPerInstance: 6,
  layers({ frame, scale, use }): readonly IMarkLayer[] {
    const { baseline, gap } = columnOptionsOf(use.options);
    const { devicePixelRatio, height } = frame.size;
    // The baseline as a fraction of the canvas height, bottom up: where the shader measures values.
    const base =
      baseline === 'bottom'
        ? (height - floorPixelOf(scale)) / height
        : canvasFractionOf(frame, scale, baseline);
    return [{ params: [gap * devicePixelRatio, base, 0, 0], outline: false }];
  },
  instances: visible => ({ first: visible.firstElement, count: visible.elementCount }),
};
