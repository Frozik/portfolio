import { candleOptionsOf } from '../../../marks/candle/core';
import type { IMarkLayer, IWebGpuMarkPainter } from '../../painter';
import candleSource from './candle.wgsl?raw';

export const candlePainter: IWebGpuMarkPainter = {
  markId: 'candle',
  source: candleSource,
  vertexFunction: 'candleVertex',
  verticesPerInstance: 6,
  layers({ frame, use }): readonly IMarkLayer[] {
    const { gap } = candleOptionsOf(use.options);
    // The gap kept beside a body, device pixels: the shader takes it off each candle's own span.
    return [{ params: [gap * frame.size.devicePixelRatio, 0, 0, 0], outline: false }];
  },
  instances: visible => ({ first: visible.firstElement, count: visible.elementCount }),
};
