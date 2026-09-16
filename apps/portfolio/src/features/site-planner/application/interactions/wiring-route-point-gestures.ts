import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { installationPreset, installationWidthMeters } from '../../domain/model/installation';
import type { WiringRoute } from '../../domain/model/wiring-routes';
import { MIN_WIRING_ROUTE_POINTS } from '../../domain/model/wiring-routes';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computePolylinePointHandles, findPathPointHandleAt } from '../render/plan-draw/draw-paths';
import type { InteractionContext } from './editor-interaction';
import { HANDLE_HIT_RADIUS_PX } from './plan-picking';
import { applyPolylineHandleHover, PolylinePointGestures } from './polyline-point-gestures';

/** The building the selected route belongs to, read off the selection. */
function selectedRouteBuilding(context: InteractionContext) {
  const { selection } = context.store;

  return selection?.kind === 'wiringRoute' ? selection.buildingId : undefined;
}

/**
 * The cable-route instantiation of the shared polyline point gestures
 * (`wiring.md` §3.3): a bend is a bare plan point on the grid, the edits go
 * through the wiring model, and a cancelled drag puts the whole route back.
 * The same squares, rings and grid magnet a path or a wall has.
 */
export function createWiringRoutePointGestures(
  context: InteractionContext
): PolylinePointGestures<WiringRoute> {
  const { store } = context;
  const { wiring } = store.electrics;

  return new PolylinePointGestures<WiringRoute>(context, {
    selected: () => wiring.selectedRoute,
    positions: route => route.points,
    movePoint: (route, pointIndex, position) => {
      const buildingId = selectedRouteBuilding(context);

      if (!isNil(buildingId)) {
        wiring.moveRoutePoint(buildingId, route.id, pointIndex, position);
      }
    },
    insertPoint: (route, segmentIndex, position) => {
      const buildingId = selectedRouteBuilding(context);

      if (!isNil(buildingId)) {
        wiring.insertRoutePoint(buildingId, route.id, segmentIndex, position);
      }
    },
    restore: route => {
      const buildingId = selectedRouteBuilding(context);

      if (!isNil(buildingId)) {
        wiring.updateRoute(buildingId, route);
      }
    },
    // A dragged bend lands beside a neighbouring route, as wide as the
    // stretch it belongs to; the route's own stretches are no neighbours.
    snapPoint: (route, pointIndex, position) => {
      const segment = route.segments[Math.min(pointIndex, route.segments.length - 1)];

      return wiring.besideRoutes(
        position,
        installationWidthMeters(installationPreset(segment.installation)),
        route.id
      );
    },
  });
}

/** The hover half, over the selected route's handles. */
export function applyWiringRouteHandleHover(context: InteractionContext, planPoint: Vector2): void {
  applyPolylineHandleHover(
    context,
    planPoint,
    context.store.electrics.wiring.selectedRoute?.points,
    {
      includeMidpoints: true,
    }
  );
}

/**
 * The double click on a bend's square takes the bend out (a route keeps its
 * last two); true when the click landed on a square and was spent there.
 */
export function removeRoutePointAt(
  context: InteractionContext,
  gestures: PolylinePointGestures<WiringRoute>,
  planPoint: Vector2,
  _modifiers: PlanModifiers
): boolean {
  const { store, getViewport } = context;
  const route = store.electrics.wiring.selectedRoute;
  const buildingId = selectedRouteBuilding(context);

  if (isNil(route) || isNil(buildingId)) {
    return false;
  }

  const viewport = getViewport();
  const handle = findPathPointHandleAt(
    computePolylinePointHandles(route.points, viewport, { includeMidpoints: true }),
    planToScreen(viewport, planPoint),
    HANDLE_HIT_RADIUS_PX
  );

  if (isNil(handle) || handle.kind !== 'vertex') {
    return false;
  }

  if (route.points.length > MIN_WIRING_ROUTE_POINTS) {
    // The double click's presses have already grabbed the point and announced
    // a step; removing is what the gesture turns out to have been.
    gestures.drop();
    store.electrics.wiring.removeRoutePoint(buildingId, route.id, handle.index);
    store.tooling.setPathHandleHighlight(undefined);
  }

  return true;
}
