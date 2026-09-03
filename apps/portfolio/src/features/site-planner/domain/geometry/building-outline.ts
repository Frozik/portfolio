import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Foundation } from '../model/foundation';
import type { Meters } from '../units';
import type { MultiPolygon, Ring } from './polygon-types';

/**
 * How wide a stem-wall run is taken to be when its volume is estimated. A
 * typical лента for a light country house; the estimate is a planning figure,
 * not a structural design.
 */
const STEM_WALL_WIDTH_METERS: Meters = 0.4;

function ringPerimeter(ring: Ring): Meters {
  let length = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const from = ring[index];
    const to = ring[(index + 1) % ring.length];

    length += Math.hypot(to.x - from.x, to.y - from.y);
  }

  return length;
}

function ringArea(ring: Ring): number {
  let doubled = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const from = ring[index];
    const to = ring[(index + 1) % ring.length];

    doubled += from.x * to.y - to.x * from.y;
  }

  return doubled / 2;
}

/**
 * The walkable outer outline of a footprint: every polygon's outer ring,
 * concatenated in order. Holes take no entries — nothing enters a building
 * through its courtyard.
 */
export function outlineLength(polygons: MultiPolygon): Meters {
  return polygons.reduce((sum, polygon) => sum + ringPerimeter(polygon.outer), 0);
}

/**
 * The point standing `offsetMeters` along the outline. The offset wraps, so a
 * value that outgrew the perimeter (the footprint shrank) still lands on the
 * outline instead of nowhere.
 */
export function pointOnOutline(polygons: MultiPolygon, offsetMeters: Meters): Vector2 | undefined {
  const total = outlineLength(polygons);

  if (total <= 0) {
    return undefined;
  }

  let remaining = ((offsetMeters % total) + total) % total;

  for (const polygon of polygons) {
    const ring = polygon.outer;

    for (let index = 0; index < ring.length; index += 1) {
      const from = ring[index];
      const to = ring[(index + 1) % ring.length];
      const segment = Math.hypot(to.x - from.x, to.y - from.y);

      if (remaining <= segment) {
        const t = segment === 0 ? 0 : remaining / segment;

        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      }

      remaining -= segment;
    }
  }

  return undefined;
}

/**
 * The inverse of {@link pointOnOutline}: the arc-length offset of the outline
 * point nearest to `point` — what a dragged entry badge writes back. Walks the
 * same rings in the same order, so the two stay each other's round trip.
 */
export function offsetAlongOutline(polygons: MultiPolygon, point: Vector2): Meters | undefined {
  let walked = 0;
  let nearestOffset: Meters | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const polygon of polygons) {
    const ring = polygon.outer;

    for (let index = 0; index < ring.length; index += 1) {
      const from = ring[index];
      const to = ring[(index + 1) % ring.length];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const segment = Math.hypot(dx, dy);

      if (segment > 0) {
        const t = Math.min(
          1,
          Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (segment * segment))
        );
        const projected = { x: from.x + dx * t, y: from.y + dy * t };
        const distance = Math.hypot(point.x - projected.x, point.y - projected.y);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestOffset = walked + segment * t;
        }
      }

      walked += segment;
    }
  }

  return nearestOffset;
}

/** Shoelace area of the fold's result: outers bound material, holes subtract. */
export function multiPolygonArea(polygons: MultiPolygon): number {
  return polygons.reduce(
    (sum, polygon) =>
      sum +
      Math.abs(ringArea(polygon.outer)) -
      polygon.holes.reduce((holeSum, hole) => holeSum + Math.abs(ringArea(hole)), 0),
    0
  );
}

/**
 * The concrete a foundation costs, as a planning estimate: a slab fills the
 * footprint through its full height, a stem wall runs the outline at a typical
 * width, and piers are not estimated — their count is not chosen yet.
 */
export function foundationVolumeCubicMeters(
  foundation: Foundation,
  polygons: MultiPolygon
): number | undefined {
  const height = foundation.depthMeters + foundation.heightAboveGroundMeters;

  switch (foundation.kind) {
    case 'slab':
      return multiPolygonArea(polygons) * height;
    case 'stem-wall':
      return outlineLength(polygons) * STEM_WALL_WIDTH_METERS * height;
    case 'pier':
      return undefined;
    default:
      return assertNever(foundation.kind);
  }
}
