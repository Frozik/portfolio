import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { UtilityRouteId } from '../../domain/model/routing';
import { MIN_ROUTE_POINTS } from '../../domain/model/routing';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computePolylinePointHandles, findPathPointHandleAt } from '../render/plan-draw/draw-paths';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { DELETE_KEYS } from './editor-interaction';
import { HANDLE_HIT_RADIUS_PX } from './plan-picking';
import { applyRouteHandleHover, RoutePointGestures } from './route-point-gestures';

/**
 * Trench editing's canvas behaviour — the path editor's point kit on the one
 * opened route: squares drag bends (a bend near its system's entry snaps onto
 * it), midpoint rings plant new ones, a double click removes one, and Delete
 * is consumed so the object cannot be taken out from under its own editor.
 */
export class RouteEditInteraction implements EditorInteraction {
  private readonly context: InteractionContext;
  private readonly routeId: UtilityRouteId;
  private readonly gestures: RoutePointGestures;

  constructor(context: InteractionContext, routeId: UtilityRouteId) {
    this.context = context;
    this.routeId = routeId;
    this.gestures = new RoutePointGestures(context);
  }

  onPointerDown(planPoint: Vector2, _modifiers: PlanModifiers): boolean {
    if (this.context.store.activeTool !== 'select') {
      return false;
    }

    this.gestures.begin(planPoint, { allowInsert: true });

    return true;
  }

  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (this.gestures.move(planPoint, modifiers)) {
      return true;
    }

    applyRouteHandleHover(this.context, planPoint, { includeMidpoints: true });

    return true;
  }

  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (!this.gestures.release(planPoint, modifiers)) {
      return false;
    }

    // The grip is released: whatever the pointer rests on now is a hover.
    applyRouteHandleHover(this.context, planPoint, { includeMidpoints: true });

    return true;
  }

  onPointerCancel(): void {
    this.gestures.cancel();
  }

  /** Over a square it takes the bend out; over emptiness it closes the editor. */
  onDoubleClick(planPoint: Vector2, _modifiers: PlanModifiers): void {
    const { store, getViewport } = this.context;
    const route = store.utilities.selectedUtilityRoute;

    if (isNil(route) || route.id !== this.routeId) {
      return;
    }

    const viewport = getViewport();
    const handle = findPathPointHandleAt(
      computePolylinePointHandles(route.points, viewport, { includeMidpoints: true }),
      planToScreen(viewport, planPoint),
      HANDLE_HIT_RADIUS_PX
    );

    if (isNil(handle)) {
      store.exitEditMode();

      return;
    }

    if (handle.kind === 'vertex' && route.points.length > MIN_ROUTE_POINTS) {
      // The double click's presses have already grabbed the point and announced
      // a step; removing is what the gesture turns out to have been.
      this.gestures.drop();
      store.utilities.removeUtilityRoutePoint(route.id, handle.index);
      // The removed point's highlight would light its successor by index.
      store.setPathHandleHighlight(undefined);
    }
  }

  onKeyDown(key: string, _modifiers: PlanModifiers): boolean {
    // Consumed with no effect: Delete must not take the edited trench out
    // from under its own editor, and the route has no sub-selection to take.
    return DELETE_KEYS.has(key);
  }

  onEscapeStep(): boolean {
    return false;
  }

  hasTransientInteraction(): boolean {
    return this.gestures.hasActive();
  }

  cancelTransients(): void {
    this.onPointerCancel();
  }
}
