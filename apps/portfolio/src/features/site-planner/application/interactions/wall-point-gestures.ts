import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from '../../domain/model/building';
import { storeysOf } from '../../domain/model/building';
import type { Wall, WallId } from '../../domain/model/walls';
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
export function createWallPointGestures(
  context: InteractionContext,
  buildingId: BuildingId
): PolylinePointGestures<Wall> {
  return new PolylinePointGestures<Wall>(context, {
    selected: () => context.store.walls.selectedWall,
    positions: wall => wall.points,
    isClosed: wall => isWallClosed(wall),
    // Dragging a vertex drags its JUNCTION: every wall vertex standing on
    // the same spot follows, so a T-стык stays a T-стык (wall topology is
    // coincidence — `wall-topology.ts`). The junction is read off the LIVE
    // wall each move: after the first apply all members already stand at
    // the previous target, one lookup away. A ground-storey corner moved
    // past the slab lands on its edge; an upper storey's is free (R24).
    movePoint: (wall, pointIndex, position) => {
      const from = liveVertexPosition(context, buildingId, wall.id, pointIndex);

      if (!isNil(from)) {
        context.store.walls.moveWallJunction(buildingId, from, position);
      }
    },
    insertPoint: (wall, segmentIndex, position) =>
      context.store.walls.insertWallPoint(
        buildingId,
        wall.id,
        segmentIndex,
        context.store.walls.clampWallPoint(buildingId, position)
      ),
    restore: wall => context.store.walls.restoreWall(buildingId, wall),
    // A junction drag edits the neighbours too, so the cancel snapshot is
    // the storey's whole wall list, not the one grabbed wall.
    captureRestore: () => {
      const walls = activeStoreyWallsOf(context, buildingId);

      return () => {
        for (const wall of walls) {
          context.store.walls.restoreWall(buildingId, wall);
        }
      };
    },
    // A finished drag re-derives the crossings it may have made or broken;
    // a plain CLICK on the vertex aims the break UI at its junction.
    onReleased: (hasMoved, wall, pointIndex) => {
      if (hasMoved) {
        context.store.walls.normalizeCrossings(buildingId);

        return;
      }

      const position = liveVertexPosition(context, buildingId, wall.id, pointIndex);

      context.store.walls.selectJunction(position);
    },
    snapPoint: (wall, pointIndex, position) =>
      oppositeEndWithinReach(context, wall, pointIndex, position),
  });
}

function activeStoreyWallsOf(context: InteractionContext, buildingId: BuildingId): readonly Wall[] {
  const building = context.store.buildings.find(candidate => candidate.id === buildingId);
  const storeyId = context.store.storeys.activeStoreyId;
  const storeys = isNil(building) ? [] : storeysOf(building);

  return (storeys.find(storey => storey.id === storeyId) ?? storeys[0])?.walls ?? [];
}

/** Where the vertex stands RIGHT NOW — the startTarget snapshot is stale mid-drag. */
function liveVertexPosition(
  context: InteractionContext,
  buildingId: BuildingId,
  wallId: WallId,
  pointIndex: number
): Vector2 | undefined {
  const wall = activeStoreyWallsOf(context, buildingId).find(candidate => candidate.id === wallId);

  return wall?.points[pointIndex];
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
