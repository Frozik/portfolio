import type { IMarkUse } from '../../../core/series/style-processor';
import { markerOptionsOf } from '../../../marks/marker/core';
import { POLYGON_FIGURES } from '../../../marks/marker/figures';
import type { IMarkLayer, IWebGpuMarkPainter } from '../../painter';
import markerSource from './marker.wgsl?raw';

const CIRCLE_CODE = 0;

/** Nought is the circle; a polygon is its place in the figure table plus one. */
function figureCode(use: IMarkUse): number {
  const { figure } = markerOptionsOf(use.options);
  return figure === 'circle' ? CIRCLE_CODE : POLYGON_FIGURES.indexOf(figure) + 1;
}

export const markerPainter: IWebGpuMarkPainter = {
  markId: 'marker',
  source: markerSource,
  vertexFunction: 'markerVertex',
  verticesPerInstance: 6,
  layers: ({ use }): readonly IMarkLayer[] => [
    { params: [figureCode(use), 0, 0, 0], outline: false },
  ],
  instances: visible => ({ first: visible.firstPoint, count: visible.pointCount }),
};
