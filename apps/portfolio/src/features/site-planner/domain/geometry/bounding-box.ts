import type { Meters } from '../units';
import type { MultiPolygon, Ring } from './polygon-types';

/** Axis-aligned bounds in plan metres. */
export interface BoundingBox {
  readonly minX: Meters;
  readonly minY: Meters;
  readonly maxX: Meters;
  readonly maxY: Meters;
}

/** Holes lie inside their outer ring, so only outer rings can widen the bounds. */
export function computeMultiPolygonBounds(polygons: MultiPolygon): BoundingBox | undefined {
  return computeBounds(polygons.map(polygon => polygon.outer));
}

function computeBounds(rings: readonly Ring[]): BoundingBox | undefined {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let hasPoint = false;

  for (const ring of rings) {
    for (const point of ring) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      hasPoint = true;
    }
  }

  return hasPoint ? { minX, minY, maxX, maxY } : undefined;
}
