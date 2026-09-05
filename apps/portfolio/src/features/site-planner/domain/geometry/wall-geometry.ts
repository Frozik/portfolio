import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Paths64 } from 'clipper2-ts';
import { EndType, inflatePaths, JoinType } from 'clipper2-ts';

import type { Opening } from '../model/openings';
import { doorSwingOf } from '../model/openings';
import type { Wall } from '../model/walls';
import { isWallClosed, MIN_WALL_POINTS } from '../model/walls';
import type { Meters } from '../units';
import { assembleMultiPolygon } from './evaluate-composition';
import { toClipperPath, toClipperUnits } from './frame';
import type { MultiPolygon } from './polygon-types';

/**
 * A mitre longer than this many half-thicknesses is clamped — the standard
 * limit that keeps a hairpin bend from spiking to infinity.
 */
const MITER_LIMIT = 4;

/**
 * The wall's centreline, whatever its reference line: a centreline wall IS its
 * drawn polyline; an outer-face wall's body lies to the right of the drawing
 * direction (a counter-clockwise loop drawn along the facade keeps the drawn
 * line outside), so its centre runs half a thickness to the right. A CLOSED
 * wall's centreline walks the ring and comes back to its start — the repeated
 * first point makes every offset along it (an opening on the closing stretch)
 * fall out of the same polyline machinery.
 */
export function wallCenterline(wall: Wall): readonly Vector2[] {
  const isClosed = isWallClosed(wall);
  const reference =
    wall.referenceLine === 'centerline'
      ? wall.points
      : offsetPolyline(wall.points, -wall.thicknessMeters / 2, { isClosed });

  return isClosed && reference.length > 0 ? [...reference, reference[0]] : reference;
}

/**
 * The solid a wall occupies on the plan: its centreline inflated by half the
 * thickness with mitred joins — square-cut ends on an open run, a mitred seam
 * on a ring — the shape a wall is, where a path's ribbon is rounded.
 */
export function buildWallBody(wall: Wall): MultiPolygon {
  const centerline = wallCenterline(wall);
  const halfThickness = toClipperUnits(wall.thicknessMeters / 2);

  if (centerline.length < MIN_WALL_POINTS || halfThickness <= 0) {
    return [];
  }

  // A ring inflates as a joined loop — the unrepeated points, every corner
  // mitred alike — where an open run gets butt-cut ends.
  return isWallClosed(wall)
    ? assembleMultiPolygon(
        inflatePaths(
          [toClipperPath(centerline.slice(0, -1))],
          halfThickness,
          JoinType.Miter,
          EndType.Joined
        )
      )
    : assembleMultiPolygon(
        inflatePaths([toClipperPath(centerline)], halfThickness, JoinType.Miter, EndType.Butt)
      );
}

/**
 * Every wall of a building as one region — bodies unioned by re-inflating them
 * together, so crossing walls merge instead of double-covering. The 3D view
 * extrudes exactly this, which is what keeps junctions from z-fighting.
 */
export function buildWallBodies(walls: readonly Wall[]): MultiPolygon {
  const paths: Paths64 = [];

  for (const wall of walls) {
    for (const polygon of buildWallBody(wall)) {
      paths.push(toClipperPath(polygon.outer));

      for (const hole of polygon.holes) {
        paths.push(toClipperPath(hole));
      }
    }
  }

  if (paths.length === 0) {
    return [];
  }

  // A zero-delta inflate is clipper's cheapest union of already-closed rings.
  return assembleMultiPolygon(inflatePaths(paths, 0, JoinType.Miter, EndType.Polygon));
}

/**
 * The outline a storey's walls enclose: the wall-body union with its holes
 * filled — a closed ring of walls contributes everything inside it, which is
 * how an upper storey's footprint derives from its own walls
 *.
 */
export function buildWallHull(wallBodies: MultiPolygon): MultiPolygon {
  return wallBodies.map(polygon => ({ outer: polygon.outer, holes: [] }));
}

export function polylineLength(points: readonly Vector2[]): number {
  let length = 0;

  for (let index = 0; index + 1 < points.length; index += 1) {
    length += Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y
    );
  }

  return length;
}

/**
 * Where the pointer lands on the polyline: the offset along it of the nearest
 * point, and how far away the pointer stands — the pair a hosted opening's
 * placement and drag both need.
 */
export function projectOntoPolyline(
  points: readonly Vector2[],
  point: Vector2
): { readonly offsetMeters: number; readonly distanceMeters: number } {
  let bestOffset = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let walked = 0;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared)
          );
    const nearest = { x: from.x + dx * t, y: from.y + dy * t };
    const distance = Math.hypot(point.x - nearest.x, point.y - nearest.y);
    const segmentLength = Math.sqrt(lengthSquared);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = walked + segmentLength * t;
    }

    walked += segmentLength;
  }

  return { offsetMeters: bestOffset, distanceMeters: bestDistance };
}

/**
 * The stretch of the polyline between two offsets along it, clamped to the
 * line — the piece of a wall an opening occupies.
 */
export function subPolyline(
  points: readonly Vector2[],
  fromOffset: number,
  toOffset: number
): readonly Vector2[] {
  const total = polylineLength(points);
  const start = Math.max(0, Math.min(fromOffset, total));
  const end = Math.max(start, Math.min(toOffset, total));

  if (end - start <= 0) {
    return [];
  }

  const result: Vector2[] = [pointAlongPolyline(points, start)];
  let walked = 0;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    const segmentEnd = walked + segmentLength;

    if (segmentEnd > start && segmentEnd < end) {
      result.push(to);
    }

    walked = segmentEnd;
  }

  result.push(pointAlongPolyline(points, end));

  return result;
}

/** The point standing `offset` along the polyline, clamped to its ends. */
export function pointAlongPolyline(points: readonly Vector2[], offset: number): Vector2 {
  let walked = 0;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);

    if (walked + segmentLength >= offset && segmentLength > 0) {
      const t = (offset - walked) / segmentLength;

      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }

    walked += segmentLength;
  }

  return points[points.length - 1];
}

/**
 * How far the opening's cutter overshoots the wall faces. A cutter must CROSS
 * the faces it opens, never merely meet them: the booleans run on clipper's
 * integer grid, and on a turned wall the rounded cutter can fall a millimetre
 * short of the rounded face — the subtraction then leaves a millimetre film of
 * wall across the whole opening, read as a painted-over window. Axis-aligned
 * walls only hid this by rounding both solids identically.
 */
const OPENING_CUT_CLEARANCE_METERS = 0.005;

/**
 * The solid an opening cuts out of its wall on the plan: the occupied stretch
 * of the centreline inflated past the wall's own thickness (see
 * {@link OPENING_CUT_CLEARANCE_METERS}) — so a slid opening follows every bend
 * its wall takes. A solid FILLING part of the slot must intersect this with
 * the wall body rather than use it raw, or it stands proud of the faces.
 */
export function buildOpeningBody(wall: Wall, opening: Opening): MultiPolygon {
  const centerline = wallCenterline(wall);
  const stretch = subPolyline(
    centerline,
    opening.offsetMeters - opening.widthMeters / 2,
    opening.offsetMeters + opening.widthMeters / 2
  );
  const halfThickness = toClipperUnits(wall.thicknessMeters / 2 + OPENING_CUT_CLEARANCE_METERS);

  if (stretch.length < MIN_WALL_POINTS || halfThickness <= 0) {
    return [];
  }

  return assembleMultiPolygon(
    inflatePaths([toClipperPath(stretch)], halfThickness, JoinType.Miter, EndType.Butt)
  );
}

/**
 * The polyline shifted sideways by `delta` — positive to the LEFT of the
 * direction of travel — with mitred joins clamped at {@link MITER_LIMIT}. On a
 * closed ring the segments wrap, so the seam point mitres between the last
 * segment and the first instead of keeping an endpoint's single normal.
 */
function offsetPolyline(
  points: readonly Vector2[],
  delta: number,
  { isClosed = false }: { readonly isClosed?: boolean } = {}
): readonly Vector2[] {
  if (points.length < MIN_WALL_POINTS || delta === 0) {
    return points;
  }

  const segmentNormal = (point: Vector2, next: Vector2): Vector2 => {
    const length = Math.hypot(next.x - point.x, next.y - point.y);

    return length === 0
      ? { x: 0, y: 0 }
      : { x: -(next.y - point.y) / length, y: (next.x - point.x) / length };
  };
  const normals = points.map((point, index) =>
    segmentNormal(point, points[(index + 1) % points.length])
  );

  return points.map((point, index) => {
    const before =
      index > 0 ? normals[index - 1] : isClosed ? normals[points.length - 1] : undefined;
    const after =
      index < points.length - 1 ? normals[index] : isClosed ? normals[index] : undefined;
    const joined = {
      x: (before?.x ?? 0) + (after?.x ?? 0),
      y: (before?.y ?? 0) + (after?.y ?? 0),
    };
    const length = Math.hypot(joined.x, joined.y);

    if (length === 0) {
      return point;
    }

    const direction = { x: joined.x / length, y: joined.y / length };
    // The mitre length grows as the bend sharpens: delta / cos(half-angle).
    const cosine = before && after ? direction.x * after.x + direction.y * after.y : 1;
    const scale = Math.min(
      Math.abs(delta / Math.max(cosine, 1 / MITER_LIMIT)),
      Math.abs(delta) * MITER_LIMIT
    );

    return {
      x: point.x + direction.x * scale * Math.sign(delta),
      y: point.y + direction.y * scale * Math.sign(delta),
    };
  });
}

/**
 * Where a door's leaf hangs and how it sweeps, in plan metres: the hinge, the
 * point the open leaf reaches, and the quarter arc between them. This is the
 * swing every floor plan draws — without it a plan cannot answer whether the
 * wardrobe beside the door will clear it, which is the first thing anyone
 * furnishing a room needs to know.
 */
export interface DoorSwingGeometry {
  readonly hinge: Vector2;
  /** The far edge of the leaf when the door stands open. */
  readonly leafEnd: Vector2;
  readonly radiusMeters: Meters;
  /** Radians, canvas convention: from the closed leaf to the open one. */
  readonly startAngle: number;
  readonly endAngle: number;
  readonly isCounterClockwise: boolean;
}

export function buildDoorSwing(wall: Wall, opening: Opening): DoorSwingGeometry | undefined {
  if (opening.kind !== 'door') {
    return undefined;
  }

  const centerline = wallCenterline(wall);
  const stretch = subPolyline(
    centerline,
    opening.offsetMeters - opening.widthMeters / 2,
    opening.offsetMeters + opening.widthMeters / 2
  );

  if (stretch.length < MIN_WALL_POINTS) {
    return undefined;
  }

  const { hingeSide, swing } = doorSwingOf(opening);
  const start = stretch[0];
  const end = stretch[stretch.length - 1];
  const hinge = hingeSide === 'start' ? start : end;
  const jamb = hingeSide === 'start' ? end : start;
  const along = { x: jamb.x - hinge.x, y: jamb.y - hinge.y };
  const radiusMeters = Math.hypot(along.x, along.y);

  if (radiusMeters === 0) {
    return undefined;
  }

  // The leaf sweeps a quarter turn off the wall, to the side it opens on;
  // plan y runs north, so «inward» is the left of the wall's own direction.
  const turn = swing === 'inward' ? Math.PI / 2 : -Math.PI / 2;
  const startAngle = Math.atan2(along.y, along.x);
  const endAngle = startAngle + turn;

  return {
    hinge,
    leafEnd: {
      x: hinge.x + Math.cos(endAngle) * radiusMeters,
      y: hinge.y + Math.sin(endAngle) * radiusMeters,
    },
    radiusMeters,
    startAngle,
    endAngle,
    isCounterClockwise: turn < 0,
  };
}
