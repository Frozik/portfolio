import type { Vector2 } from '@frozik/utils/math/vector2';

import type { EdgeRef, FaceKind, Level } from './level';
import { scale, subtract } from './vector';

/** Something the swept circle can run into: a face with its outward normal, direction and length precomputed. */
export interface Segment {
  readonly from: Vector2;
  readonly to: Vector2;
  readonly direction: Vector2;
  readonly normal: Vector2;
  readonly length: number;
}

export interface SegmentHit {
  /** Where along the motion the contact happens, 0..1. */
  readonly time: number;
  /** Contact normal, pointing away from the segment towards the ball. */
  readonly normal: Vector2;
  /** `face` for the flat part, `corner` for a rounded end. */
  readonly at: 'face' | 'corner';
}

export interface WallHit extends SegmentHit, EdgeRef {
  readonly kind: FaceKind;
}

/**
 * Earliest contact of a circle moving from `from` to `to` with a segment,
 * treating the segment as a capsule of the circle's radius: the flat face
 * offset outward by the radius, and a circle at each end. Only approaching
 * motion counts, so a ball already touching a face and moving away is free.
 * Written without allocations: it runs for every face of every wall on
 * every step, and the solver runs thousands of steps per level.
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

/** The earliest wall the moving circle touches, with the face it belongs to. */
export function sweepCircleAgainstWalls(
  level: Level,
  from: Vector2,
  to: Vector2,
  radius: number
): WallHit | undefined {
  let best: WallHit | undefined;
  const minX = Math.min(from.x, to.x) - radius;
  const maxX = Math.max(from.x, to.x) + radius;
  const minY = Math.min(from.y, to.y) - radius;
  const maxY = Math.max(from.y, to.y) + radius;
  const { walls } = level;
  for (let wallIndex = 0; wallIndex < walls.length; wallIndex += 1) {
    const wall = walls[wallIndex];
    const { bounds } = wall;
    if (bounds.max.x < minX || bounds.min.x > maxX || bounds.max.y < minY || bounds.min.y > maxY) {
      continue;
    }
    const { edges } = wall;
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
      const edge = edges[edgeIndex];
      const hit = sweepCircleAgainstSegment(from, to, radius, edge);
      if (hit !== undefined && (best === undefined || hit.time < best.time)) {
        best = { ...hit, wall: wallIndex, edge: edgeIndex, kind: edge.kind };
      }
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
