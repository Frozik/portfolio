import type { Vector2 } from '@frozik/utils/math/vector2';

import type { EdgeRef, FaceKind, Segment, Wall } from './level';
import { pointAlongEdge } from './level';
import { distance, dot, scale, subtract } from './vector';

export interface SegmentHit {
  /** Where along the motion the contact happens, 0..1. */
  readonly time: number;
  /** Contact normal, pointing away from the segment towards the ball. */
  readonly normal: Vector2;
  /** `face` for the flat part, `corner` for a rounded end. */
  readonly at: 'face' | 'corner';
}

/** A contact with a face of some kind: what the response is computed from. */
export interface Impact extends SegmentHit {
  readonly kind: FaceKind;
}

export interface WallHit extends Impact, EdgeRef {}

/** The earlier of two contacts along the same motion. */
export function earlierHit<A extends SegmentHit, B extends SegmentHit>(
  a: A | undefined,
  b: B | undefined
): A | B | undefined {
  if (a === undefined || b === undefined) {
    return a ?? b;
  }
  return a.time <= b.time ? a : b;
}

/** How far a point lies from the nearest point of a segment. */
export function distanceToSegment(point: Vector2, segment: Segment): number {
  const offset = subtract(point, segment.from);
  const along = Math.min(Math.max(dot(offset, segment.direction), 0), segment.length);
  return distance(point, pointAlongEdge(segment, along));
}

/**
 * How far apart two segments lie at their nearest: nothing if they cross,
 * else the least of each end to the other segment — the nearest points of
 * two segments that do not cross always include an end of one of them.
 */
export function distanceBetweenSegments(a: Segment, b: Segment): number {
  if (segmentsCross(a, b)) {
    return 0;
  }
  return Math.min(
    distanceToSegment(a.from, b),
    distanceToSegment(a.to, b),
    distanceToSegment(b.from, a),
    distanceToSegment(b.to, a)
  );
}

/** Whether two segments cross: each one's ends lie on opposite sides of the other's line. */
function segmentsCross(a: Segment, b: Segment): boolean {
  const side = (segment: Segment, point: Vector2): number =>
    (segment.to.x - segment.from.x) * (point.y - segment.from.y) -
    (segment.to.y - segment.from.y) * (point.x - segment.from.x);
  const bAcrossA = side(a, b.from) * side(a, b.to);
  const aAcrossB = side(b, a.from) * side(b, a.to);
  return bAcrossA < 0 && aAcrossB < 0;
}

/** Whether any of the segments comes within `reach` of the point. */
export function reachesPoint(segments: readonly Segment[], point: Vector2, reach: number): boolean {
  return segments.some(segment => distanceToSegment(point, segment) <= reach);
}

/**
 * Earliest contact of a circle moving from `from` to `to` with a segment,
 * treating the segment as a capsule of the circle's radius: the flat face
 * offset outward by the radius, and a circle at each end. Only approaching
 * motion counts, so a ball already touching a face and moving away is free.
 * Written without allocations: it runs for every face of every wall on
 * every step, and the aim preview replays the steps on every pointer move.
 */
export function sweepCircleAgainstSegment(
  from: Vector2,
  to: Vector2,
  radius: number,
  segment: Segment
): SegmentHit | undefined {
  const motionX = to.x - from.x;
  const motionY = to.y - from.y;
  const approach = segment.normal.x * motionX + segment.normal.y * motionY;
  let best: SegmentHit | undefined;

  if (approach < 0) {
    const offsetX = from.x - segment.from.x;
    const offsetY = from.y - segment.from.y;
    const startDistance = segment.normal.x * offsetX + segment.normal.y * offsetY;
    if (startDistance >= 0) {
      const time = Math.max(0, (radius - startDistance) / approach);
      if (time <= 1) {
        const along =
          (offsetX + motionX * time) * segment.direction.x +
          (offsetY + motionY * time) * segment.direction.y;
        if (along >= 0 && along <= segment.length) {
          best = { time, normal: segment.normal, at: 'face' };
        }
      }
    }
  }

  const fromEnd = sweepCircleAgainstPoint(from, motionX, motionY, radius, segment.from);
  if (fromEnd !== undefined && (best === undefined || fromEnd.time < best.time)) {
    best = fromEnd;
  }
  const toEnd = sweepCircleAgainstPoint(from, motionX, motionY, radius, segment.to);
  if (toEnd !== undefined && (best === undefined || toEnd.time < best.time)) {
    best = toEnd;
  }
  return best;
}

/** Earliest contact of the moving circle with a point (a rounded corner). */
function sweepCircleAgainstPoint(
  from: Vector2,
  motionX: number,
  motionY: number,
  radius: number,
  point: Vector2
): SegmentHit | undefined {
  const offsetX = from.x - point.x;
  const offsetY = from.y - point.y;
  const a = motionX * motionX + motionY * motionY;
  const b = 2 * (offsetX * motionX + offsetY * motionY);
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (a === 0 || b >= 0) {
    return undefined;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return undefined;
  }
  const time = Math.max(0, (-b - Math.sqrt(discriminant)) / (2 * a));
  if (time > 1) {
    return undefined;
  }
  const contactX = from.x + motionX * time - point.x;
  const contactY = from.y + motionY * time - point.y;
  const size = Math.hypot(contactX, contactY);
  return { time, normal: { x: contactX / size, y: contactY / size }, at: 'corner' };
}

/** The earliest face of one wall the moving circle touches; nothing when the motion stays clear of the wall's box. */
export function sweepCircleAgainstWall(
  wall: Wall,
  from: Vector2,
  to: Vector2,
  radius: number
): (Impact & { readonly edge: number }) | undefined {
  const { bounds } = wall;
  if (
    bounds.max.x < Math.min(from.x, to.x) - radius ||
    bounds.min.x > Math.max(from.x, to.x) + radius ||
    bounds.max.y < Math.min(from.y, to.y) - radius ||
    bounds.min.y > Math.max(from.y, to.y) + radius
  ) {
    return undefined;
  }
  let best: (Impact & { readonly edge: number }) | undefined;
  const { edges } = wall;
  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    const edge = edges[edgeIndex];
    const hit = sweepCircleAgainstSegment(from, to, radius, edge);
    if (hit !== undefined && (best === undefined || hit.time < best.time)) {
      best = { ...hit, edge: edgeIndex, kind: edge.kind };
    }
  }
  return best;
}

/** The earliest wall the moving circle touches, with the face it belongs to. */
export function sweepCircleAgainstWalls(
  walls: readonly Wall[],
  from: Vector2,
  to: Vector2,
  radius: number
): WallHit | undefined {
  let best: WallHit | undefined;
  for (let wallIndex = 0; wallIndex < walls.length; wallIndex += 1) {
    const hit = sweepCircleAgainstWall(walls[wallIndex], from, to, radius);
    if (hit !== undefined && (best === undefined || hit.time < best.time)) {
      best = { ...hit, wall: wallIndex };
    }
  }
  return best;
}

/** The position reached at `time` along the motion, backed off the contact by `epsilon`. */
export function contactPosition(
  from: Vector2,
  to: Vector2,
  hit: SegmentHit,
  epsilon: number
): Vector2 {
  const motion = subtract(to, from);
  const reached = { x: from.x + motion.x * hit.time, y: from.y + motion.y * hit.time };
  const backOff = scale(hit.normal, epsilon);
  return { x: reached.x + backOff.x, y: reached.y + backOff.y };
}
