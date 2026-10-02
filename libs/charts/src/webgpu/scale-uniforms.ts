import type { IChartFrame } from '../core/frame/chart-frame';
import type { IScaleFrame } from '../core/scale/scale';
import { fractionOf, toAxis } from '../core/scale/scale-mapping';
import { splitValue } from './texel-encoding';

const SCALE_KIND_CODE = { linear: 0, log: 1 } as const;

export interface IScaleUniforms {
  readonly valueKind: number;
  readonly valueMin: readonly [number, number];
  readonly invValueSpan: number;
  readonly scaleOrigin: number;
  readonly scaleShare: number;
}

/** A value scale as the shader takes it: the layer uniforms that turn a value into a height on the canvas. */
export function scaleUniformsOf(frame: IChartFrame<unknown>, scale: IScaleFrame): IScaleUniforms {
  const { height } = frame.size;
  const min = toAxis(scale.kind, scale.min);
  const max = toAxis(scale.kind, scale.max);
  const bottom = (height - scale.area.top - scale.area.height) / height;
  const share = scale.area.height / height;
  // An inverted scale grows downwards from the top of its stretch: the same mapping with a negative share.
  return {
    valueKind: SCALE_KIND_CODE[scale.kind],
    valueMin: scale.kind === 'log' ? [min, 0] : splitValue(scale.min),
    invValueSpan: 1 / (max - min),
    scaleOrigin: scale.inverted ? bottom + share : bottom,
    scaleShare: scale.inverted ? -share : share,
  };
}

/** A value as the fraction of the canvas height from its bottom: where the shader puts it. */
export function canvasFractionOf(
  frame: IChartFrame<unknown>,
  scale: IScaleFrame,
  value: number
): number {
  const { height } = frame.size;
  const bottom = (height - scale.area.top - scale.area.height) / height;
  return bottom + (fractionOf(scale, value) * scale.area.height) / height;
}
