import { floorPixelOf } from '../../../core/scale/scale-mapping';
import { areaOptionsOf } from '../../../marks/area/core';
import type { TLineJoin } from '../../../marks/line/core';
import type { IMarkLayer, IWebGpuMarkPainter } from '../../painter';
import { canvasFractionOf } from '../../scale-uniforms';
import { joinInstances } from '../../visible-slice';
import areaSource from './area.wgsl?raw';

const JOIN_CODE: Readonly<Record<TLineJoin, number>> = { linear: 0, stepAfter: 1, stepBefore: 2 };
export const areaPainter: IWebGpuMarkPainter = {
  markId: 'area',
  source: areaSource,
  vertexFunction: 'areaVertex',
  verticesPerInstance: 6,
  layers({ frame, scale, use }): readonly IMarkLayer[] {
    const { baseline, join } = areaOptionsOf(use.options);
    const { height } = frame.size;
    // The baseline as a fraction of the canvas height, bottom up: where the shader measures values.
    const fraction =
      baseline === 'bottom'
        ? (height - floorPixelOf(scale)) / height
        : canvasFractionOf(frame, scale, baseline);
    return [{ params: [JOIN_CODE[join], fraction, 0, 0], outline: false }];
  },
  instances: (visible, use) => joinInstances(visible, areaOptionsOf(use.options).join),
};
