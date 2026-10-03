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

/** Where an element's interval lies on the canvas, device pixels. */
export interface IElementSpan {
  readonly left: number;
  readonly width: number;
}

/**
 * The interval of an element as drawn: its step from its position forward,
 * or backward when the run stamps the end — but no further than the
 * neighbour on that side, which is where an axis with stretches taken out
 * brings the elements round them together.
 */
export function elementSpanOf(
  frame: IChartFrame<unknown>,
  run: TRun<unknown>,
  element: number
): IElementSpan {
  const step = stepPixelsOf(frame, run);
  const x = xToPixel(frame, run.x[element]);
  if (run.aggregateTime === 'start') {
    const next = element + 1 < run.length ? xToPixel(frame, run.x[element + 1]) : x + step;
    return { left: x, width: Math.max(0, Math.min(step, next - x)) };
  }
  const previous = element > 0 ? xToPixel(frame, run.x[element - 1]) : x - step;
  const width = Math.max(0, Math.min(step, x - previous));
  return { left: x - width, width };
}

/** The points of the elements in view: an element is one point, a candle four spread evenly over its interval — open, low, high, close. */
export function pointsOf(
  frame: IChartFrame<unknown>,
  run: TRun<unknown>,
  scale: IScaleFrame
): IPathPoint[] {
  const { from, to } = visibleElements(frame, run);
  const points: IPathPoint[] = [];
  for (let element = from; element < to; element += 1) {
    if (run.shape === 'point') {
      const value = run.value[element];
      const x = xToPixel(frame, run.x[element]);
      points.push({ x, y: valueToPixel(scale, value), element, isGap: Number.isNaN(value) });
      continue;
    }
    const corners = [run.open[element], run.min[element], run.max[element], run.close[element]];
    const isGap = Number.isNaN(corners[0]);
    const { left, width } = elementSpanOf(frame, run, element);
    for (let corner = 0; corner < CANDLE_CORNERS; corner += 1) {
      points.push({
        x: left + (width * (corner * 2 + 1)) / CORNER_SPREAD,
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
    // A step after holds its value up to the next element even when nothing stands there:
    // the level run reaches a gap, and only the riser into it is lost.
    const corner: IPathPoint =
      join === 'stepAfter'
        ? { ...point, x: next.x }
        : { ...next, x: point.x, isGap: point.isGap || next.isGap };
    return [point, corner];
  });
}
