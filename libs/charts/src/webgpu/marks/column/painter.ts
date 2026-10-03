import { floorPixelOf } from '../../../core/scale/scale-mapping';
import { columnOptionsOf } from '../../../marks/column/core';
import type { IMarkLayer, IWebGpuMarkPainter } from '../../painter';
import { canvasFractionOf } from '../../scale-uniforms';
import columnSource from './column.wgsl?raw';

/** Columns of data that is not aggregated have no interval to be narrowed to. */
const NO_WIDTH_LIMIT = Number.POSITIVE_INFINITY;

export const columnPainter: IWebGpuMarkPainter = {
  markId: 'column',
  source: columnSource,
  vertexFunction: 'columnVertex',
  verticesPerInstance: 6,
  layers({ frame, scale, styled, use }): readonly IMarkLayer[] {
    const { baseline, gap } = columnOptionsOf(use.options);
    const { devicePixelRatio, width, height } = frame.size;
    const stepPixels = ((styled.run.step ?? 0) / frame.xSpan) * width;
    const widest = stepPixels > 0 ? stepPixels - gap * devicePixelRatio : NO_WIDTH_LIMIT;
    // The baseline as a fraction of the canvas height, bottom up: where the shader measures values.
    const base =
      baseline === 'bottom'
        ? (height - floorPixelOf(scale)) / height
        : canvasFractionOf(frame, scale, baseline);
    return [{ params: [widest, base, 0, 0], outline: false }];
  },
  instances: visible => ({ first: visible.firstElement, count: visible.elementCount }),
};
