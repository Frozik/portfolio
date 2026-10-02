import type { IScaleFrame, TScaleKind } from './scale';

const PERCENT = 100;

/** A value as the axis measures it: itself on a linear scale, its logarithm on a logarithmic one. */
export function toAxis(kind: TScaleKind, value: number): number {
  return kind === 'log' ? Math.log(value) : value;
}

export function fromAxis(kind: TScaleKind, measure: number): number {
  return kind === 'log' ? Math.exp(measure) : measure;
}

/**
 * How far up its stretch of the canvas a value lies: nought at the bottom, one
 * at the top. An inverted scale has its minimum at the top.
 */
export function fractionOf(scale: IScaleFrame, value: number): number {
  const min = toAxis(scale.kind, scale.min);
  const max = toAxis(scale.kind, scale.max);
  const along = (toAxis(scale.kind, value) - min) / (max - min);
  return scale.inverted ? 1 - along : along;
}

/** Device pixels from the top of the canvas. One mapping for series, grid, ticks and crosshair, on every backend. */
export function valueToPixel(scale: IScaleFrame, value: number): number {
  const { top, height } = scale.area;
  return top + height - fractionOf(scale, value) * height;
}

export function pixelToValue(scale: IScaleFrame, pixel: number): number {
  const fromBottom = 1 - (pixel - scale.area.top) / scale.area.height;
  const fraction = scale.inverted ? 1 - fromBottom : fromBottom;
  const min = toAxis(scale.kind, scale.min);
  const max = toAxis(scale.kind, scale.max);
  return fromAxis(scale.kind, min + fraction * (max - min));
}

/** The edge of the pane the minimum of the scale lies on: what a mark standing "on the bottom" grows from. */
export function floorPixelOf(scale: IScaleFrame): number {
  return scale.inverted ? scale.plot.top : scale.plot.bottom;
}

/** The change from the base of a per cent scale, in per cent. */
export function percentOf(base: number, value: number): number {
  return (value / base - 1) * PERCENT;
}

export function valueOfPercent(base: number, percent: number): number {
  return base * (1 + percent / PERCENT);
}
