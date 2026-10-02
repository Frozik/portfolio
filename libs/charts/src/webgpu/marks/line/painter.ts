import type { IPaint } from '../../../core/series/style-processor';
import type { TLineJoin } from '../../../marks/line/core';
import { lineOptionsOf } from '../../../marks/line/core';
import type { IMarkLayer, IWebGpuMarkPainter } from '../../painter';
import { joinInstances } from '../../visible-slice';
import lineSource from './line.wgsl?raw';

const JOIN_CODE: Readonly<Record<TLineJoin, number>> = { linear: 0, stepAfter: 1, stepBefore: 2 };
function isVisible(paint: IPaint): boolean {
  return typeof paint.size !== 'number' || paint.size > 0;
}

export const linePainter: IWebGpuMarkPainter = {
  markId: 'line',
  source: lineSource,
  vertexFunction: 'lineVertex',
  verticesPerInstance: 12,
  layers({ styled, use }): readonly IMarkLayer[] {
    const { join, paint } = lineOptionsOf(use.options);
    const params = [JOIN_CODE[join], paint === 'stroke' ? 1 : 0, 0, 0] as const;
    const body: IMarkLayer = { params, outline: false };
    // The outline is the same line drawn wider underneath: no seams where segments meet.
    return paint === 'fill' && isVisible(styled.style.stroke)
      ? [{ params, outline: true }, body]
      : [body];
  },
  instances: (visible, use) => joinInstances(visible, lineOptionsOf(use.options).join),
};
