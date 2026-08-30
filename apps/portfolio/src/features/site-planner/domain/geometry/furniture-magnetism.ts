import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { Wall } from '../model/walls';
import type { Meters } from '../units';
import { wallCenterline } from './wall-geometry';

const RADIANS_PER_DEGREE = Math.PI / 180;

interface WallCatch {
  readonly facePoint: Vector2;
  readonly outwardNormal: Vector2;
  readonly distance: Meters;
}

/**
 * The Sweet Home 3D magnet (`building-editor.md` §6): a piece released near a
 * wall turns its back to it and snaps flush against the face. Answers the
 * pose the magnet would give, or nothing while no wall is within reach —
 * the caller falls back to the grid.
 */
export function magnetizeFurnitureToWall({
  position,
  depthMeters,
  walls,
  thresholdMeters,
}: {
  readonly position: Vector2;
  readonly depthMeters: Meters;
  readonly walls: readonly Wall[];
  readonly thresholdMeters: Meters;
}): { readonly position: Vector2; readonly rotationDegrees: number } | undefined {
  let best: WallCatch | undefined;

  for (const wall of walls) {
    const caught = catchOnWall(wall, position);

    if (!isNil(caught) && (isNil(best) || caught.distance < best.distance)) {
      best = caught;
    }
  }

  if (isNil(best) || best.distance > thresholdMeters + depthMeters / 2) {
    return undefined;
  }

  const halfDepth = depthMeters / 2;
  // The front faces local +y; rotating (0, 1) by θ gives (−sin θ, cos θ), so
  // the θ that points the front along the outward normal is atan2(−n.x, n.y).
  const rotationDegrees =
    Math.atan2(-best.outwardNormal.x, best.outwardNormal.y) / RADIANS_PER_DEGREE;

  return {
    position: {
      x: best.facePoint.x + best.outwardNormal.x * halfDepth,
      y: best.facePoint.y + best.outwardNormal.y * halfDepth,
    },
    rotationDegrees,
  };
}

/** Where the piece would sit against this wall: the near face point and its normal. */
function catchOnWall(wall: Wall, position: Vector2): WallCatch | undefined {
  const centerline = wallCenterline(wall);
  let best: WallCatch | undefined;

  for (let index = 0; index + 1 < centerline.length; index += 1) {
    const from = centerline[index];
    const to = centerline[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      continue;
    }

    const t = Math.max(
      0,
      Math.min(1, ((position.x - from.x) * dx + (position.y - from.y) * dy) / lengthSquared)
    );
    const nearest = { x: from.x + dx * t, y: from.y + dy * t };
    const length = Math.sqrt(lengthSquared);
    const leftNormal = { x: -dy / length, y: dx / length };
    const side = Math.sign(
      (position.x - nearest.x) * leftNormal.x + (position.y - nearest.y) * leftNormal.y
    );
    const outwardNormal = side >= 0 ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
    const facePoint = {
      x: nearest.x + outwardNormal.x * (wall.thicknessMeters / 2),
      y: nearest.y + outwardNormal.y * (wall.thicknessMeters / 2),
    };
    const distance = Math.hypot(position.x - facePoint.x, position.y - facePoint.y);

    if (isNil(best) || distance < best.distance) {
      best = { facePoint, outwardNormal, distance };
    }
  }

  return best;
}
