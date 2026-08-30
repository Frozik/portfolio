import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';

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
