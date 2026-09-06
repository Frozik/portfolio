import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { projectOntoPolyline, wallCenterline } from '../../domain/geometry/wall-geometry';
import type { BuildingId } from '../../domain/model/building';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { InteractionContext } from './editor-interaction';
import { snapPointToGrid } from './grid-snapping';
import { pickDevice, pickWall } from './storey-object-picking';

/** With the opening tool in hand, a click hangs the armed preset on a wall; false when it missed. */
export function placeOpeningAt(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): boolean {
  const wall = pickWall(context, buildingId, planPoint);

  if (isNil(wall)) {
    return false;
  }

  const { offsetMeters } = projectOntoPolyline(wallCenterline(wall), planPoint);

  context.store.openings.addOpeningAt(buildingId, wall.id, offsetMeters);

  return true;
}

/** With the electric tool: wall kinds hang on a wall, a light goes on the ceiling. */
export function placeDeviceAt(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2,
  modifiers: PlanModifiers
): void {
  const { store } = context;
  const kind = store.electrics.armedDeviceKind;

  if (kind === 'light') {
    store.electrics.addCeilingLightAt(buildingId, snapPointToGrid(store, planPoint, modifiers));

    return;
  }

  const wall = pickWall(context, buildingId, planPoint);

  if (isNil(wall)) {
    return;
  }

  const { offsetMeters } = projectOntoPolyline(wallCenterline(wall), planPoint);

  store.electrics.addWallDeviceAt(buildingId, kind, wall.id, offsetMeters);
}

/**
 * The connect tool: the first click takes a device, the second wires the
 * pair — panel to consumer, or switch to light — and lets go either way.
 */
export function connectDeviceAt(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): void {
  const { store } = context;
  const device = pickDevice(context, buildingId, planPoint);

  if (isNil(device)) {
    store.electrics.setPendingConnectDeviceId(undefined);

    return;
  }

  const pending = store.electrics.pendingConnectDeviceId;

  if (isNil(pending)) {
    store.electrics.setPendingConnectDeviceId(device.id);

    return;
  }

  store.electrics.connectDevices(buildingId, pending, device.id);
  store.electrics.setPendingConnectDeviceId(undefined);
}
