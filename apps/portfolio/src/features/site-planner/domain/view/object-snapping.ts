import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';

/** How close, on screen, a cursor has to come before a key point catches it. */
export const KEY_POINT_SNAP_RADIUS_PX = 10;

/**
 * A pair of key points close enough to be joined, and the translation that
 * joins them. `delta` is what a gesture dragging a whole shape adds to its
 * centre; a gesture placing a single point substitutes `targetPoint` for it.
 */
export interface KeyPointSnap {
  readonly delta: Vector2;
  /** The point of the shape being edited, where the pointer would have left it. */
  readonly ownPoint: Vector2;
  /** The point of another shape it is caught by. */
  readonly targetPoint: Vector2;
}

/**
 * The closest pair of key points within the capture distance, or nothing when
 * none is in reach. The nearest catch wins so that a corner between two
 * neighbours goes to the one the pointer leans towards; ties keep the pair
 * found first, which makes a gesture repeatable.
 */
export function findKeyPointSnap(
  ownPoints: readonly Vector2[],
  targetPoints: readonly Vector2[],
  maxDistanceMeters: Meters
): KeyPointSnap | undefined {
  if (!(maxDistanceMeters > 0) || !Number.isFinite(maxDistanceMeters)) {
    return undefined;
  }

  let closest: KeyPointSnap | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const ownPoint of ownPoints) {
    for (const targetPoint of targetPoints) {
      const delta: Vector2 = {
        x: targetPoint.x - ownPoint.x,
        y: targetPoint.y - ownPoint.y,
      };
      const distance = Math.hypot(delta.x, delta.y);

      if (distance > maxDistanceMeters || distance >= closestDistance) {
        continue;
      }

      closestDistance = distance;
      closest = { delta, ownPoint, targetPoint };
    }
  }

  return closest;
}

/**
 * The points a drawn corner should catch on: every drawn corner of the walls
 * already standing, and the midpoint of every stretch between them. This is
 * the CAD object snap — endpoint and midpoint — and unlike the angle lock it
 * is ALWAYS live: a wall that starts «about here» beside another wall's corner
 * is a wall that will not close its room.
 */
export function wallSnapPoints(
  walls: readonly { readonly points: readonly Vector2[] }[]
): readonly Vector2[] {
  const points: Vector2[] = [];

  for (const wall of walls) {
    for (let index = 0; index < wall.points.length; index += 1) {
      const point = wall.points[index];

      points.push(point);

      const next = wall.points[index + 1];

      if (next !== undefined) {
        points.push({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 });
      }
    }
  }

  return points;
}

/** The nearest snap point within reach, or nothing when none is close. */
export function findNearestSnapPoint(
  candidates: readonly Vector2[],
  point: Vector2,
  maxDistanceMeters: Meters
): Vector2 | undefined {
  let closest: Vector2 | undefined;
  let closestDistance = maxDistanceMeters;

  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);

    if (distance <= closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }

  return closest;
}
