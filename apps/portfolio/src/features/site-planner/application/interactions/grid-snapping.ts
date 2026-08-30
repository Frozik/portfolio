import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../../domain/units';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { NO_SNAP_STEP, snapLength, snapPoint } from '../../domain/view/snapping';
import type { SitePlannerStore } from '../SitePlannerStore';

/** Alt suspends snapping for as long as it is held, without touching the setting. */
export function gridStep(store: SitePlannerStore, modifiers: PlanModifiers): Meters {
  const { isSnapEnabled, gridStepMeters } = store.settings;

  return isSnapEnabled && !modifiers.isAltPressed ? gridStepMeters : NO_SNAP_STEP;
}

export function snapPointToGrid(
  store: SitePlannerStore,
  point: Vector2,
  modifiers: PlanModifiers
): Vector2 {
  return snapPoint(point, gridStep(store, modifiers));
}

export function snapRadiusToGrid(
  store: SitePlannerStore,
  center: Vector2,
  planPoint: Vector2,
  modifiers: PlanModifiers
): Meters {
  return snapLength(
    Math.hypot(planPoint.x - center.x, planPoint.y - center.y),
    gridStep(store, modifiers)
  );
}

export function offsetBetween(from: Vector2, to: Vector2): Vector2 {
  return { x: to.x - from.x, y: to.y - from.y };
}
