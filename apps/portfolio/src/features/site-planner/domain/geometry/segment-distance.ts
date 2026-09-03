import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';
import type { Meters } from '../units';
import type { MultiPolygon, Ring } from './polygon-types';

/**
 * Point-to-geometry distances, kept apart from anything that knows what the
 * geometry MEANS. Hit testing, terrain grading and the cantilever measure all
 * ask this question, and each used to answer it with a copy of the same loop —
 * one of them with the arguments in a different order, which is exactly the
 * kind of bug a shared primitive cannot have.
 */
export function distanceToSegment(start: Vector2, end: Vector2, point: Vector2): Meters {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength === 0) {
    return Math.hypot(start.x - point.x, start.y - point.y);
  }

  const projection = clamp(
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / squaredLength,
    0,
    1
  );

  return Math.hypot(
    start.x + projection * segmentX - point.x,
    start.y + projection * segmentY - point.y
  );
}

/** Distance to a closed ring — its last point joins its first. */
export function distanceToRing(ring: Ring, point: Vector2): Meters {
  let shortest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < ring.length; index += 1) {
    shortest = Math.min(
      shortest,
      distanceToSegment(ring[index], ring[(index + 1) % ring.length], point)
    );
  }

  return shortest;
}

/** Distance to the nearest edge of any polygon, holes counted as edges too. */
export function distanceToMultiPolygonEdge(polygons: MultiPolygon, point: Vector2): Meters {
  let shortest = Number.POSITIVE_INFINITY;

  for (const polygon of polygons) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      shortest = Math.min(shortest, distanceToRing(ring, point));
    }
  }

  return shortest;
}
