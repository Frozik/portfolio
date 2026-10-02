import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../core/frame/chart-frame';
import type { IScaleFrame } from '../../core/scale/scale';
import { valueToPixel } from '../../core/scale/scale-mapping';
import type { TRun } from '../../core/series/point-run';
import { lowerBound, upperBound } from '../../core/series/search';
import { xToPixel } from '../../core/viewport/plot-mapping';
import type { TLineJoin } from '../../marks/line/core';

const CANDLE_CORNERS = 4;
const CORNER_SPREAD = 8;

export interface IPathPoint {
  readonly x: number;
  readonly y: number;
  /** The element the point belongs to: its paint is the paint of whatever starts here. */
  readonly element: number;
  readonly isGap: boolean;
}

/** A colour or a size of an element, whether the paint is one for the run or one per element. */
export function paintAt(values: number | Uint32Array | Float32Array, element: number): number {
  return typeof values === 'number' ? values : values[element];
}

/** The elements in view and one beyond each edge, so what enters the view starts outside it. */
export function visibleElements(
  frame: IChartFrame<unknown>,
  run: TRun<unknown>
): { readonly from: number; readonly to: number } {
  return {
    from: Math.max(0, lowerBound(frame.domain, run.x, run.length, frame.x.start) - 1),
    to: Math.min(run.length, upperBound(frame.domain, run.x, run.length, frame.x.end) + 1),
  };
}

/** The width of one element's interval, device pixels; nought for data that is not aggregated. */
export function stepPixelsOf(frame: IChartFrame<unknown>, run: TRun<unknown>): number {
  return ((run.step ?? 0) / frame.xSpan) * frame.size.width;
}

/** The points of the elements in view: an element is one point, a candle four spread evenly over its interval — open, low, high, close. */
export function pointsOf(
  frame: IChartFrame<unknown>,
  run: TRun<unknown>,
  scale: IScaleFrame
): IPathPoint[] {
  const { from, to } = visibleElements(frame, run);
  const stepPixels = stepPixelsOf(frame, run);
  const points: IPathPoint[] = [];
  for (let element = from; element < to; element += 1) {
    const x = xToPixel(frame, run.x[element]);
    if (run.shape === 'point') {
      const value = run.value[element];
      points.push({ x, y: valueToPixel(scale, value), element, isGap: Number.isNaN(value) });
      continue;
    }
    const corners = [run.open[element], run.min[element], run.max[element], run.close[element]];
    const isGap = Number.isNaN(corners[0]);
    for (let corner = 0; corner < CANDLE_CORNERS; corner += 1) {
      points.push({
        x: x + (stepPixels * (corner * 2 + 1)) / CORNER_SPREAD,
        y: valueToPixel(scale, corners[corner]),
        element,
        isGap,
      });
    }
  }
  return points;
}

/** With a step join, a corner is put between every two neighbours. */
export function joined(points: readonly IPathPoint[], join: TLineJoin): readonly IPathPoint[] {
  if (join === 'linear') {
    return points;
  }
  return points.flatMap((point, index) => {
    const next = points[index + 1];
    if (isNil(next)) {
      return [point];
    }
    const corner: IPathPoint =
      join === 'stepAfter'
        ? { ...point, x: next.x, isGap: point.isGap || next.isGap }
        : { ...next, x: point.x, isGap: point.isGap || next.isGap };
    return [point, corner];
  });
}
