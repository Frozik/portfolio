import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from '../../domain/model/site-plan';
import type { Wall } from '../../domain/model/walls';
import { isWallClosed } from '../../domain/model/walls';
import type { InteractionContext } from './editor-interaction';
import { HANDLE_HIT_RADIUS_PX } from './plan-picking';
import { applyPolylineHandleHover, PolylinePointGestures } from './polyline-point-gestures';

/**
 * The wall instantiation of the shared polyline point gestures: corners are
 * the drawn reference points, edits go through the wall actions, and an OPEN
 * wall's dragged endpoint magnetizes onto its opposite end — the gesture that
 * closes the contour into a ring (the release seals it, `closeWallRing`).
 */
export class WallPointGestures extends PolylinePointGestures<Wall> {
  constructor(context: InteractionContext, buildingId: BuildingId) {
    super(context, {
      selected: () => context.store.walls.selectedWall,
      positions: wall => wall.points,
      isClosed: wall => isWallClosed(wall),
      // A ground-storey corner moved or planted past the slab lands on its
      // edge; an upper storey's corner is free to overhang (R24).
      movePoint: (wall, pointIndex, position) =>
        context.store.walls.moveWallPoint(
          buildingId,
          wall.id,
          pointIndex,
          context.store.walls.clampWallPoint(buildingId, position)
        ),
      insertPoint: (wall, segmentIndex, position) =>
        context.store.walls.insertWallPoint(
          buildingId,
          wall.id,
          segmentIndex,
          context.store.walls.clampWallPoint(buildingId, position)
        ),
      restore: wall => context.store.walls.restoreWall(buildingId, wall),
      snapPoint: (wall, pointIndex, position) =>
        oppositeEndWithinReach(context, wall, pointIndex, position),
    });
  }
}

/**
 * The opposite endpoint, when the dragged one comes within a handle's reach of
 * it — the same radius the handles answer clicks at, so what looks grabbable
 * is what magnetizes.
 */
function oppositeEndWithinReach(
  context: InteractionContext,
  wall: Wall,
  pointIndex: number,
  position: Vector2
): Vector2 | undefined {
  if (isWallClosed(wall) || wall.points.length < 2) {
    return undefined;
  }

  const lastIndex = wall.points.length - 1;
  const opposite =
    pointIndex === 0
      ? wall.points[lastIndex]
      : pointIndex === lastIndex
        ? wall.points[0]
        : undefined;

  if (isNil(opposite)) {
    return undefined;
  }

  const withinMeters = HANDLE_HIT_RADIUS_PX / context.getViewport().pixelsPerMeter;

  return Math.hypot(opposite.x - position.x, opposite.y - position.y) <= withinMeters
    ? opposite
    : undefined;
}

/** The hover half, over the selected wall's handles. */
export function applyWallHandleHover(context: InteractionContext, planPoint: Vector2): void {
  const wall = context.store.walls.selectedWall;

  applyPolylineHandleHover(context, planPoint, wall?.points, {
    includeMidpoints: true,
    isClosed: isNil(wall) ? false : isWallClosed(wall),
  });
}
