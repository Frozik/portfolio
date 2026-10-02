import { candleOptionsOf } from '../../../marks/candle/core';
import type { IMarkLayer, IWebGpuMarkPainter } from '../../painter';
import candleSource from './candle.wgsl?raw';

export const candlePainter: IWebGpuMarkPainter = {
  markId: 'candle',
  source: candleSource,
  vertexFunction: 'candleVertex',
  verticesPerInstance: 6,
  layers({ frame, styled, use }): readonly IMarkLayer[] {
    const { gap } = candleOptionsOf(use.options);
    const { devicePixelRatio, width } = frame.size;
    const stepPixels = ((styled.run.step ?? 0) / frame.xSpan) * width;
    // The widest a body may be for the gap to survive, device pixels.
    return [{ params: [stepPixels - gap * devicePixelRatio, 0, 0, 0], outline: false }];
  },
  instances: visible => ({ first: visible.firstElement, count: visible.elementCount }),
};
