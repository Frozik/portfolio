import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { ContourSegment } from './contour-types';

/** Joining the marching-squares segments of one level into polylines, endpoint to endpoint. */
/**
 * Tolerance for recognising the shared end of two segments, as a fraction of the
 * cell size. Neighbouring cells compute the point on their shared edge from the
 * same two samples, so the values agree to the last bit — the tolerance only
 * guards the arithmetic, and stays far below anything the drawing can resolve.
 */
export const JOIN_TOLERANCE_FACTOR = 1e-4;

/**
 * Joins loose segments into the longest chains they form. Every segment is used
 * exactly once, so a level made of several separate lines yields one chain each,
 * and a closed loop ends where it started.
 */
export function chainSegments(
  segments: readonly ContourSegment[],
  joinTolerance: number
): readonly (readonly Vector2[])[] {
  const segmentsByEndpoint = new Map<string, number[]>();

  segments.forEach((segment, index) => {
    registerEndpoint(segmentsByEndpoint, pointKey(segment.start, joinTolerance), index);
    registerEndpoint(segmentsByEndpoint, pointKey(segment.end, joinTolerance), index);
  });

  const isUsed = new Uint8Array(segments.length);
  const chains: (readonly Vector2[])[] = [];

  segments.forEach((segment, index) => {
    if (isUsed[index] === 1) {
      return;
    }

    isUsed[index] = 1;

    const forward = extendChain(segments, segmentsByEndpoint, isUsed, segment.end, joinTolerance);
    const backward = extendChain(
      segments,
      segmentsByEndpoint,
      isUsed,
      segment.start,
      joinTolerance
    );

    chains.push([...backward.reverse(), segment.start, segment.end, ...forward]);
  });

  return chains;
}

/** Walks unused segments away from `from`, returning the points it passes. */
function extendChain(
  segments: readonly ContourSegment[],
  segmentsByEndpoint: ReadonlyMap<string, readonly number[]>,
  isUsed: Uint8Array,
  from: Vector2,
  joinTolerance: number
): Vector2[] {
  const points: Vector2[] = [];
  let currentKey = pointKey(from, joinTolerance);

  // Every step consumes one segment, so the walk cannot outlive the supply.
  for (let step = 0; step < segments.length; step += 1) {
    const candidates = segmentsByEndpoint.get(currentKey);
    const nextIndex = candidates?.find(candidate => isUsed[candidate] === 0);

    if (isNil(nextIndex)) {
      return points;
    }

    isUsed[nextIndex] = 1;

    const segment = segments[nextIndex];
    const next =
      pointKey(segment.start, joinTolerance) === currentKey ? segment.end : segment.start;

    points.push(next);
    currentKey = pointKey(next, joinTolerance);
  }

  return points;
}

function registerEndpoint(
  segmentsByEndpoint: Map<string, number[]>,
  key: string,
  index: number
): void {
  const existing = segmentsByEndpoint.get(key);

  if (isNil(existing)) {
    segmentsByEndpoint.set(key, [index]);

    return;
  }

  existing.push(index);
}

function pointKey(point: Vector2, joinTolerance: number): string {
  return `${Math.round(point.x / joinTolerance)}:${Math.round(point.y / joinTolerance)}`;
}
