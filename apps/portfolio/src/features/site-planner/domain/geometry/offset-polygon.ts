import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Paths64 } from 'clipper2-ts';
import { EndType, inflatePaths, JoinType } from 'clipper2-ts';

import type { Meters } from '../units';
import { assembleMultiPolygon } from './evaluate-composition';
import { toClipperPath, toClipperUnits } from './frame';
import type { MultiPolygon, Ring } from './polygon-types';

const MIN_RIBBON_POINT_COUNT = 2;

/**
 * Offsets every ring of the plot by `deltaMeters` — negative for the inward
 * setback line. Mitred corners keep straight boundaries parallel to the plot,
 * which is what a setback drawing is expected to look like.
 */
export function offsetPolygons(polygons: MultiPolygon, deltaMeters: Meters): MultiPolygon {
  const delta = toClipperUnits(deltaMeters);

  if (delta === 0) {
    return polygons;
  }

  const paths: Paths64 = [];

  for (const polygon of polygons) {
    paths.push(toClipperPath(polygon.outer));

    for (const hole of polygon.holes) {
      paths.push(toClipperPath(hole));
    }
  }

  if (paths.length === 0) {
    return [];
  }

  return assembleMultiPolygon(inflatePaths(paths, delta, JoinType.Miter, EndType.Polygon));
}

/** Widens a path polyline into its walkable ribbon: rounded joins and rounded ends. */
export function buildPathRibbon(points: readonly Vector2[], widthMeters: Meters): MultiPolygon {
  const halfWidth = toClipperUnits(widthMeters / 2);

  if (points.length < MIN_RIBBON_POINT_COUNT || halfWidth <= 0) {
    return [];
  }

  return assembleMultiPolygon(
    inflatePaths([toClipperPath(points)], halfWidth, JoinType.Round, EndType.Round)
  );
}

/**
 * The ribbon of a polyline with square-cut ends — the strip a paving seam's
 * gradient is painted into: its butt edges are where the gradient meets each
 * neighbouring surface, so they must not reach past with a cap.
 */
export function buildButtRibbon(points: readonly Vector2[], widthMeters: Meters): MultiPolygon {
  const halfWidth = toClipperUnits(widthMeters / 2);

  if (points.length < MIN_RIBBON_POINT_COUNT || halfWidth <= 0) {
    return [];
  }

  return assembleMultiPolygon(
    inflatePaths([toClipperPath(points)], halfWidth, JoinType.Round, EndType.Butt)
  );
}

/** Vertices per disc: enough that a metre-wide cap reads as round at plan zooms. */
const DISC_SEGMENT_COUNT = 32;
const FULL_TURN_RADIANS = 2 * Math.PI;

function discRing(center: Vector2, radius: number): Ring {
  const ring: Vector2[] = [];

  for (let index = 0; index < DISC_SEGMENT_COUNT; index += 1) {
    const angle = (index / DISC_SEGMENT_COUNT) * FULL_TURN_RADIANS;

    ring.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }

  return ring;
}

/**
 * The ribbon of a polyline whose width varies point to point: each segment
 * contributes the trapezoid its two half-widths span, each point the disc that
 * rounds its join or cap, and the union of them all is the walkable polygon.
 * With every width equal it degenerates to {@link buildPathRibbon}'s shape, so
 * that exact (and cheaper) construction is kept for the uniform case.
 */
export function buildVariableWidthRibbon(
  points: readonly { readonly position: Vector2; readonly width: Meters }[]
): MultiPolygon {
  if (points.length < MIN_RIBBON_POINT_COUNT) {
    return [];
  }

  if (points.every(point => point.width === points[0].width)) {
    return buildPathRibbon(
      points.map(point => point.position),
      points[0].width
    );
  }

  const rings: Paths64 = [];

  for (const point of points) {
    if (point.width > 0) {
      rings.push(toClipperPath(discRing(point.position, point.width / 2)));
    }
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y);

    if (length === 0) {
      continue;
    }

    const normalX = -(end.position.y - start.position.y) / length;
    const normalY = (end.position.x - start.position.x) / length;
    const startHalf = start.width / 2;
    const endHalf = end.width / 2;

    rings.push(
      toClipperPath(
        // The union folds with the non-zero rule, so a clockwise ring would
        // CANCEL the discs it overlaps — the winding must not depend on which
        // way the segment happens to run.
        ensureCounterClockwise([
          { x: start.position.x + normalX * startHalf, y: start.position.y + normalY * startHalf },
          { x: end.position.x + normalX * endHalf, y: end.position.y + normalY * endHalf },
          { x: end.position.x - normalX * endHalf, y: end.position.y - normalY * endHalf },
          { x: start.position.x - normalX * startHalf, y: start.position.y - normalY * startHalf },
        ])
      )
    );
  }

  return assembleMultiPolygon(rings);
}

/** The ring with a positive shoelace area — material under the non-zero rule. */
function ensureCounterClockwise(ring: Ring): Ring {
  let doubledArea = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index];
    const next = ring[(index + 1) % ring.length];

    doubledArea += point.x * next.y - next.x * point.y;
  }

  return doubledArea < 0 ? [...ring].reverse() : ring;
}
