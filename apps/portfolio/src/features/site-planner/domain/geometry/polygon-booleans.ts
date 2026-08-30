import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Paths64 } from 'clipper2-ts';
import { difference, FillRule, intersect } from 'clipper2-ts';

import { assembleMultiPolygon } from './evaluate-composition';
import { toClipperPath } from './frame';
import type { MultiPolygon } from './polygon-types';
import { triangulateMultiPolygon } from './triangulate-polygon';

function toPaths(polygons: MultiPolygon): Paths64 {
  const paths: Paths64 = [];

  for (const polygon of polygons) {
    paths.push(toClipperPath(polygon.outer));

    for (const hole of polygon.holes) {
      paths.push(toClipperPath(hole));
    }
  }

  return paths;
}

/** `subject` minus `clip`, re-assembled into validated polygons with holes. */
export function subtractPolygons(subject: MultiPolygon, clip: MultiPolygon): MultiPolygon {
  if (subject.length === 0 || clip.length === 0) {
    return subject;
  }

  return assembleMultiPolygon(difference(toPaths(subject), toPaths(clip), FillRule.NonZero));
}

/** The region both cover, re-assembled into validated polygons with holes. */
export function intersectPolygons(subject: MultiPolygon, clip: MultiPolygon): MultiPolygon {
  if (subject.length === 0 || clip.length === 0) {
    return [];
  }

  return assembleMultiPolygon(intersect(toPaths(subject), toPaths(clip), FillRule.NonZero));
}

/**
 * Whether the point lies inside the covered region: within an outer ring and
 * outside that polygon's holes. Ray casting per ring, tolerant of the point
 * landing exactly on an edge (counted as inside).
 */
export function isPointInMultiPolygon(
  polygons: MultiPolygon,
  point: { readonly x: number; readonly y: number }
): boolean {
  for (const polygon of polygons) {
    if (!isPointInRing(polygon.outer, point)) {
      continue;
    }

    const isInHole = polygon.holes.some(hole => isPointInRing(hole, point));

    if (!isInHole) {
      return true;
    }
  }

  return false;
}

/**
 * The point itself while it lies on the material, and the nearest spot of the
 * region's boundary otherwise — what keeps a wall corner on the foundation
 * slab however far the pointer roams. A point inside a hole clamps to the
 * hole's rim, since every ring competes for nearest. Nothing to clamp against
 * returns the point untouched.
 */
export function clampPointToMultiPolygon(polygons: MultiPolygon, point: Vector2): Vector2 {
  if (polygons.length === 0 || isPointInMultiPolygon(polygons, point)) {
    return point;
  }

  let nearest = point;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const polygon of polygons) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      for (let index = 0; index < ring.length; index += 1) {
        const candidate = closestPointOnSegment(
          ring[index],
          ring[(index + 1) % ring.length],
          point
        );
        const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = candidate;
        }
      }
    }
  }

  return nearest;
}

function closestPointOnSegment(start: Vector2, end: Vector2, point: Vector2): Vector2 {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength === 0) {
    return start;
  }

  const projection = Math.min(
    Math.max(((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / squaredLength, 0),
    1
  );

  return { x: start.x + projection * segmentX, y: start.y + projection * segmentY };
}

function isPointInRing(
  ring: readonly { readonly x: number; readonly y: number }[],
  point: { readonly x: number; readonly y: number }
): boolean {
  let isInside = false;

  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const current = ring[index];
    const before = ring[previous];
    const crosses =
      current.y > point.y !== before.y > point.y &&
      point.x <
        ((before.x - current.x) * (point.y - current.y)) / (before.y - current.y) + current.x;

    if (crosses) {
      isInside = !isInside;
    }
  }

  return isInside;
}

const COORDINATES_PER_VERTEX = 2;
const TRIANGLE_VERTEX_COUNT = 3;

/**
 * A point guaranteed to lie INSIDE the covered region. The centroid is not
 * that point: an annulus — the exposed ceiling around a надстройка — centres
 * on its own hole. The first triangle of the region's triangulation cannot
 * miss.
 */
export function interiorPointOf(
  polygons: MultiPolygon
): { readonly x: number; readonly y: number } | undefined {
  const mesh = triangulateMultiPolygon(polygons);

  if (mesh.indices.length < TRIANGLE_VERTEX_COUNT) {
    return undefined;
  }

  let x = 0;
  let y = 0;

  for (let corner = 0; corner < TRIANGLE_VERTEX_COUNT; corner += 1) {
    const vertex = mesh.indices[corner] * COORDINATES_PER_VERTEX;

    x += mesh.positions[vertex];
    y += mesh.positions[vertex + 1];
  }

  return { x: x / TRIANGLE_VERTEX_COUNT, y: y / TRIANGLE_VERTEX_COUNT };
}
