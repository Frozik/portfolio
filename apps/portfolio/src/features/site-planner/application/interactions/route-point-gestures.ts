import type { Vector2 } from '@frozik/utils/math/vector2';

import type { UtilityRoute } from '../../domain/model/routing';
import type { InteractionContext } from './editor-interaction';
import { applyPolylineHandleHover, PolylinePointGestures } from './polyline-point-gestures';

/** How far a dragged trench bend reaches for a matching utility entry. */
export const ENTRY_SNAP_RADIUS_PX = 14;

/**
 * The trench instantiation of the shared polyline point gestures: bends are
 * bare plan points, edits go through the route actions, and a bend dragged
 * near its system's entry lands exactly on it — the §3 seam holds while the
 * line is reshaped, not only while it is drawn.
 */
export class RoutePointGestures extends PolylinePointGestures<UtilityRoute> {
  constructor(context: InteractionContext) {
    super(context, {
      selected: () => context.store.utilities.selectedUtilityRoute,
      positions: route => route.points,
      movePoint: (route, pointIndex, position) =>
        context.store.utilities.moveUtilityRoutePoint(route.id, pointIndex, position),
      insertPoint: (route, segmentIndex, position) =>
        context.store.utilities.insertUtilityRoutePoint(route.id, segmentIndex, position),
      restore: route => context.store.utilities.updateUtilityRoute(route),
      snapPoint: (route, _pointIndex, position) =>
        context.store.utilities.nearestEntryPoint(
          position,
          ENTRY_SNAP_RADIUS_PX / context.getViewport().pixelsPerMeter,
          route.system
        ),
    });
  }
}

/** The hover half, over the selected trench's handles. */
export function applyRouteHandleHover(
  context: InteractionContext,
  planPoint: Vector2,
  options: { readonly includeMidpoints: boolean }
): void {
  applyPolylineHandleHover(
    context,
    planPoint,
    context.store.utilities.selectedUtilityRoute?.points,
    options
  );
}
