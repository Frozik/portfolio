import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from '../../domain/model/building';
import type { Wall } from '../../domain/model/walls';
import { isWallClosed, MIN_CLOSED_WALL_POINTS } from '../../domain/model/walls';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computePolylinePointHandles, findPathPointHandleAt } from '../render/plan-draw/draw-paths';
import type { InteractionContext } from './editor-interaction';
import { HANDLE_HIT_RADIUS_PX } from './plan-picking';
import type { PolylinePointGestures } from './polyline-point-gestures';

/** Closes the selected wall once its two ends stand on one point. */
export function sealRingIfEndsMeet(context: InteractionContext, buildingId: BuildingId): void {
  const { store } = context;
  const wall = store.walls.selectedWall;

  if (isNil(wall) || isWallClosed(wall) || wall.points.length < MIN_CLOSED_WALL_POINTS + 1) {
    return;
  }

  const [first] = wall.points;
  const last = wall.points[wall.points.length - 1];

  if (first.x === last.x && first.y === last.y) {
    store.walls.closeWallRing(buildingId, wall.id);
  }
}

/** The corner the double click landed on, removed — or cut with Alt held. */
export function editWallCornerAt(
  context: InteractionContext,
  buildingId: BuildingId,
  wallGestures: PolylinePointGestures<Wall>,
  planPoint: Vector2,
  modifiers: PlanModifiers
): boolean {
  const { store, getViewport } = context;
  const wall = store.walls.selectedWall;

  if (isNil(wall)) {
    return false;
  }

  const viewport = getViewport();
  const handle = findPathPointHandleAt(
    computePolylinePointHandles(wall.points, viewport, {
      includeMidpoints: true,
      isClosed: isWallClosed(wall),
    }),
    planToScreen(viewport, planPoint),
    HANDLE_HIT_RADIUS_PX
  );

  if (isNil(handle) || handle.kind !== 'vertex') {
    return false;
  }

  // The double click's presses have already grabbed the point and announced
  // a step; what the gesture turns out to have been is this edit.
  wallGestures.drop();

  if (modifiers.isAltPressed) {
    store.walls.cutWallAtPoint(buildingId, wall.id, handle.index);
  } else {
    store.walls.removeWallPoint(buildingId, wall.id, handle.index);
  }

  // The gone point's highlight would light its successor by index.
  store.tooling.setPathHandleHighlight(undefined);

  return true;
}
