import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { computeMultiPolygonBounds } from '../../domain/geometry/bounding-box';
import type { SitePath } from '../../domain/model/plot-objects';
import type { UtilityRoute } from '../../domain/model/routing';
import type { SiteObjectState } from '../../domain/model/site-object';
import {
  SITE_OBJECT_TRAITS,
  siteObjectReference,
  siteObjectSelection,
  translateSiteObject,
} from '../../domain/model/site-object';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computeCarHandles } from '../render/plan-draw/draw-cars';
import { computeBuildingHandles } from '../render/plan-draw/draw-house';
import type { InteractionContext } from './editor-interaction';
import { snapPointToGrid } from './grid-snapping';
import { ObjectDragGestures } from './object-drag-gestures';
import { applyPathHandleHover, createPathPointGestures } from './path-point-gestures';
import { findHandleAt, pickPlacedInstance, pickSiteObject } from './plan-picking';
import type { PolylinePointGestures } from './polyline-point-gestures';
import { applyRouteHandleHover, createRoutePointGestures } from './route-point-gestures';

/**
 * What the select and placing tools take hold of while VIEWING the plot: a
 * tree or a car slid, a building or a path slid whole, a car or a building
 * turned by its grip, a selected path's or trench's points dragged by their
 * squares. Inside an editor the editor's own interaction answers instead.
 */
export class ViewModeGestures {
  private readonly context: InteractionContext;
  /**
   * The one whole-object gesture, whatever the kind under the pointer. The
   * object as it stood at the grab is what every move re-derives from, so no
   * rounding accumulates and a cancel puts it back whole.
   */
  private readonly objects: ObjectDragGestures;
  /** The grip on the points of a selected path (squares only here). */
  private readonly pathGestures: PolylinePointGestures<SitePath>;
  /** The same grip on a selected trench's bends. */
  private readonly routeGestures: PolylinePointGestures<UtilityRoute>;

  constructor(context: InteractionContext) {
    this.context = context;
    this.objects = new ObjectDragGestures(context);
    this.pathGestures = createPathPointGestures(context);
    this.routeGestures = createRoutePointGestures(context);
  }

  hasActive(): boolean {
    return (
      this.objects.hasActive() || this.pathGestures.hasActive() || this.routeGestures.hasActive()
    );
  }

  move(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    return (
      this.objects.move(planPoint, modifiers) ||
      this.pathGestures.move(planPoint, modifiers) ||
      this.routeGestures.move(planPoint, modifiers)
    );
  }

  /** True when a whole object was set down: nothing else is left to hover. */
  releaseObject(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    return this.objects.release(planPoint, modifiers);
  }

  /** True when a point square was let go — whatever the pointer rests on now is a hover. */
  releasePolyline(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    return (
      this.pathGestures.release(planPoint, modifiers) ||
      this.routeGestures.release(planPoint, modifiers)
    );
  }

  cancel(): void {
    this.objects.cancel();
    this.pathGestures.cancel();
    this.routeGestures.cancel();
  }

  /**
   * What view mode's select takes hold of, nearest grip first: the selected
   * car's turn grip, a selected path's point squares, then the whole object
   * under the pointer.
   */
  beginSelect(planPoint: Vector2): void {
    if (
      this.beginCarRotation(planPoint) ||
      this.beginBuildingRotation(planPoint) ||
      this.pathGestures.begin(planPoint, { allowInsert: false }) ||
      this.routeGestures.begin(planPoint, { allowInsert: false })
    ) {
      return;
    }

    const object = pickSiteObject(this.context.store, this.context.getViewport(), planPoint);

    if (isNil(object)) {
      this.context.store.setSelection(undefined);

      return;
    }

    this.beginObjectDrag(object, planPoint);
  }

  /**
   * With the placing tool in hand, a click on empty ground puts down whatever
   * the catalogue has chosen, and a click on something already placed picks that
   * up instead — the same button both places and adjusts, as it does for
   * elevation marks. The grip of a selected car answers first, so a car can be
   * turned without leaving the tool that placed it.
   */
  beginPlacement(planPoint: Vector2, modifiers: PlanModifiers): void {
    if (this.beginCarRotation(planPoint)) {
      return;
    }

    const object = pickPlacedInstance(this.context.store, this.context.getViewport(), planPoint);

    if (!isNil(object)) {
      this.beginObjectDrag(object, planPoint);

      return;
    }

    this.context.store.siteObjects.placeSelectedObject(
      snapPointToGrid(this.context.store, planPoint, modifiers)
    );
    this.context.store.tooling.finishPlacement();
  }

  /**
   * Takes hold of the object under the pointer as one whole thing: selects it,
   * and — when its kind moves in view mode (`SITE_OBJECT_TRAITS`) — starts the
   * drag that slides all of it, whatever its internal anatomy.
   */
  private beginObjectDrag(object: SiteObjectState, planPoint: Vector2): void {
    this.context.store.setSelection(siteObjectSelection(object));

    if (!SITE_OBJECT_TRAITS[object.kind].isMovable) {
      return;
    }

    const startReference = siteObjectReference(object);

    if (isNil(startReference)) {
      return;
    }

    // Slides the object rigidly, its reference point snapped to the grid.
    this.objects.beginMove(
      {
        origin: startReference,
        moveTo: (draggedPoint, modifiers) => {
          const reference = snapPointToGrid(this.context.store, draggedPoint, modifiers);

          this.context.store.siteObjects.applySiteObject(
            translateSiteObject(object, {
              x: reference.x - startReference.x,
              y: reference.y - startReference.y,
            })
          );
        },
        restore: () => this.context.store.siteObjects.applySiteObject(object),
      },
      planPoint
    );
  }

  /**
   * View mode's idle hover over the selected polyline's squares — a path's or
   * a trench's, whichever is selected; other modes clear it.
   */
  updateHover(planPoint: Vector2): void {
    if (this.context.store.editorMode.kind !== 'view') {
      this.context.store.tooling.setPathHandleHighlight(undefined);

      return;
    }

    if (!isNil(this.context.store.utilities.selectedUtilityRoute)) {
      applyRouteHandleHover(this.context, planPoint, { includeMidpoints: false });

      return;
    }

    applyPathHandleHover(this.context, planPoint, { includeMidpoints: false });
  }

  /**
   * The grip over the selected building's footprint turns the WHOLE house —
   * storeys, furniture and the roof ridge together. View mode only: inside an
   * editor the building is being worked on, not arranged.
   */
  private beginBuildingRotation(planPoint: Vector2): boolean {
    const building = this.context.store.building.selectedBuilding;

    if (isNil(building) || this.context.store.editorMode.kind !== 'view') {
      return false;
    }

    const scene = this.context.store.scene.buildingScenes.find(
      candidate => candidate.building.id === building.id
    );
    const bounds = isNil(scene) ? undefined : computeMultiPolygonBounds(scene.polygons);

    if (isNil(scene) || isNil(bounds)) {
      return false;
    }

    const viewport = this.context.getViewport();
    const handle = findHandleAt(
      computeBuildingHandles(scene.polygons, viewport),
      planToScreen(viewport, planPoint)
    );

    if (isNil(handle)) {
      return false;
    }

    const pivot: Vector2 = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };

    // The turn is the sweep from the grab, applied to the building as it stood;
    // a zero-degree turn from there IS the restore.
    return this.objects.beginRotate(
      {
        origin: pivot,
        startRotationDegrees: 0,
        turnTo: degrees => this.context.store.building.turnWholeBuilding(building, degrees),
        restore: () => this.context.store.building.turnWholeBuilding(building, 0),
      },
      planPoint
    );
  }

  private beginCarRotation(planPoint: Vector2): boolean {
    const car = this.context.store.siteObjects.selectedCar;

    if (isNil(car)) {
      return false;
    }

    const viewport = this.context.getViewport();
    const handle = findHandleAt(
      computeCarHandles(car, viewport),
      planToScreen(viewport, planPoint)
    );

    if (isNil(handle)) {
      return false;
    }

    return this.objects.beginRotate(
      {
        origin: car.position,
        startRotationDegrees: car.rotationDegrees,
        turnTo: rotationDegrees =>
          this.context.store.siteObjects.updateCar({ ...car, rotationDegrees }),
        restore: () => this.context.store.siteObjects.updateCar(car),
      },
      planPoint
    );
  }
}
