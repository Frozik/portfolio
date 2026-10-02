import type { TShape } from '../core/series/shape';
import type { TLineJoin } from '../marks/line/core';

const POINTS_PER_ELEMENT: Readonly<Record<TShape, number>> = { point: 1, candle: 4 };

/** The part of a layer's elements that is on screen, counted from the first element of its first chunk. */
export interface IVisibleSlice {
  readonly firstElement: number;
  readonly elementCount: number;
  /** The same in points: an element is one point, a candle four. */
  readonly firstPoint: number;
  readonly pointCount: number;
}

export interface IInstanceRange {
  readonly first: number;
  readonly count: number;
}

/**
 * Elements `from`…`to` of a run inside a layer whose chunks begin at a slot
 * boundary and hold `layerElements` elements. Only these are drawn: an
 * element far outside the view may be further from it than the shader's
 * 32-bit seconds can measure, and would land on the wrong side of the plot.
 */
export function visibleSliceOf(
  shape: TShape,
  from: number,
  to: number,
  elementsPerSlot: number,
  layerElements: number
): IVisibleSlice {
  const firstElement = from % elementsPerSlot;
  const elementCount = Math.max(0, Math.min(to - from, layerElements - firstElement));
  const perElement = POINTS_PER_ELEMENT[shape];
  return {
    firstElement,
    elementCount,
    firstPoint: firstElement * perElement,
    pointCount: elementCount * perElement,
  };
}

/** The instances that join the visible points: a segment per pair of neighbours, two with a step join. */
export function joinInstances(slice: IVisibleSlice, join: TLineJoin): IInstanceRange {
  return join === 'linear'
    ? { first: slice.firstPoint, count: Math.max(0, slice.pointCount - 1) }
    : { first: slice.firstPoint * 2, count: Math.max(0, slice.pointCount * 2 - 2) };
}
