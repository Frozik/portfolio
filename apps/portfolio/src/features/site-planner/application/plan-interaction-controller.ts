import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { computeMultiPolygonBounds } from '../domain/geometry/bounding-box';
import type { EditorMode, EditTarget } from '../domain/model/editor-mode';
import {
  editorDoorFor,
  editorToolForHotkey,
  isPlanTool,
  isToolAllowed,
} from '../domain/model/editor-mode';
import type { UtilityRoute } from '../domain/model/routing';
import type { PlanTool } from '../domain/model/selection';
import type { SiteObjectState } from '../domain/model/site-object';
import {
  SITE_OBJECT_TRAITS,
  siteObjectReference,
  siteObjectSelection,
  translateSiteObject,
} from '../domain/model/site-object';
import type { SitePath } from '../domain/model/site-plan';
import type { PlanInputTarget, PlanModifiers } from '../domain/view/plan-input';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { planToScreen } from '../domain/view/plan-viewport';
import { BuildingEditInteraction } from './interactions/building-edit-interaction';
import type { EditorInteraction, InteractionContext } from './interactions/editor-interaction';
import { DELETE_KEYS } from './interactions/editor-interaction';
import { snapPointToGrid } from './interactions/grid-snapping';
import { ObjectDragGestures } from './interactions/object-drag-gestures';
import { PathEditInteraction } from './interactions/path-edit-interaction';
import { applyPathHandleHover, createPathPointGestures } from './interactions/path-point-gestures';
import {
  findHandleAt,
  pickPath,
  pickPlacedInstance,
  pickShape,
  pickSiteObject,
  pickUtilityRoute,
} from './interactions/plan-picking';
import type { PolylinePointGestures } from './interactions/polyline-point-gestures';
import { RouteEditInteraction } from './interactions/route-edit-interaction';
import {
  applyRouteHandleHover,
  createRoutePointGestures,
  ENTRY_SNAP_RADIUS_PX,
} from './interactions/route-point-gestures';
import { SiteEditInteraction } from './interactions/site-edit-interaction';
import { computeCarHandles } from './render/plan-draw/draw-cars';
import { computeBuildingHandles } from './render/plan-draw/draw-house';
import type { SitePlannerStore } from './SitePlannerStore';

export const TOOL_HOTKEYS: Readonly<Record<string, PlanTool | undefined>> = {
  v: 'select',
  h: 'pan',
  r: 'rectangle',
  c: 'circle',
  i: 'ellipse',
  e: 'elevation',
  t: 'tree',
  p: 'path',
  n: 'utility',
  m: 'measure',
};

const CANCEL_KEY = 'Escape';
/**
 * Figma's habit: Enter descends into the selected object's editor, Escape
 * climbs back out. Tab is taken — it flips the plan and the 3D view.
 */
const ENTER_MODE_KEY = 'Enter';
/** Finishes the polyline of a path, as the double click does. */
const COMMIT_KEY = 'Enter';

/**
 * Turns pointer and key input into plan edits. It owns no DOM and no rendering:
 * the input layer hands it plan-space points, it reads the active tool and the
 * selection from the store, and it writes back through the store's edit actions.
 *
 * The controller is the SHELL of the interaction system (see
 * `object-editors.md`): it keeps what every mode shares — the cursor readout,
 * the tool hotkeys, the Escape ladder, undo/redo, the shared tools, and view
 * mode itself, the editor of the whole plan. An open editor's own canvas
 * behaviour lives in its `EditorInteraction`, created on entry and dropped
 * with the mode; each event is offered to it before the shared handling runs.
 */
export class PlanInteractionController implements PlanInputTarget {
  private readonly store: SitePlannerStore;
  private readonly getViewport: () => PlanViewport;
  private readonly context: InteractionContext;
  /**
   * View mode's one whole-object gesture, whatever the kind under the pointer —
   * a tree or a car slid, a building or a path slid whole, a car or a building
   * turned by its grip. The object as it stood at the grab is what every move
   * re-derives from, so no rounding accumulates and a cancel puts it back whole.
   */
  private readonly viewObjects: ObjectDragGestures;
  /** View mode's grip on the points of a selected path (squares only there). */
  private readonly viewPathGestures: PolylinePointGestures<SitePath>;
  /** The same grip on a selected trench's bends. */
  private readonly viewRouteGestures: PolylinePointGestures<UtilityRoute>;
  private editInteraction:
    | { readonly mode: EditorMode; readonly interaction: EditorInteraction }
    | undefined = undefined;
  /**
   * Whether the pointer has moved since it went down. A click that only selects
   * must write nothing: replaying the drag for it would snap a position typed
   * into the properties panel back onto the grid, and leave an empty step to
   * undo and an autosave behind it.
   */
  private hasPointerMoved = false;

  constructor({
    store,
    getViewport,
  }: {
    readonly store: SitePlannerStore;
    readonly getViewport: () => PlanViewport;
  }) {
    this.store = store;
    this.getViewport = getViewport;
    this.context = { store, getViewport, hasPointerMoved: () => this.hasPointerMoved };
    this.viewObjects = new ObjectDragGestures(this.context);
    this.viewPathGestures = createPathPointGestures(this.context);
    this.viewRouteGestures = createRoutePointGestures(this.context);
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): void {
    this.store.view.setCursorPlanPoint(planPoint);
    this.store.view.setCursorModifiers(modifiers);
    this.hasPointerMoved = false;

    const interaction = this.currentEditInteraction();

    if (!isNil(interaction) && interaction.onPointerDown(planPoint, modifiers)) {
      return;
    }

    const tool = this.store.activeTool;

    // An editor-scoped tool belongs wholly to the open editor's interaction,
    // which had its chance above; the shell has no shared handling for it.
    if (!isPlanTool(tool)) {
      return;
    }

    switch (tool) {
      case 'select':
        // Only reachable while viewing: an open editor consumed its own select.
        this.beginViewSelectGesture(planPoint);

        return;
      case 'measure':
        this.store.setMeasurePoints([
          ...this.store.measurePoints,
          snapPointToGrid(this.store, planPoint, modifiers),
        ]);

        return;
      case 'tree':
        this.beginPlacementGesture(planPoint, modifiers);

        return;
      case 'path':
        this.store.siteObjects.appendDraftPathPoint(
          snapPointToGrid(this.store, planPoint, modifiers)
        );

        return;
      case 'utility':
        this.store.utilities.appendDraftUtilityPoint(this.snapUtilityPoint(planPoint, modifiers));

        return;
      // The site editor's own tools were consumed above; the pan tool never
      // reaches the controller — the input layer takes the drag for the
      // viewport before an interaction target is consulted.
      case 'rectangle':
      case 'circle':
      case 'ellipse':
      case 'elevation':
      case 'pan':
        return;
      default:
        assertNever(tool);
    }
  }

  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): void {
    this.store.view.setCursorPlanPoint(planPoint);
    // The draft previews read these, so the segment drawn is the segment a
    // click commits — Shift locking it square has to be visible to be honest.
    this.store.view.setCursorModifiers(modifiers);
    this.hasPointerMoved = true;

    const interaction = this.currentEditInteraction();

    if (!isNil(interaction) && interaction.onPointerMove(planPoint, modifiers)) {
      return;
    }

    if (this.viewObjects.move(planPoint, modifiers)) {
      return;
    }

    if (this.viewPathGestures.move(planPoint, modifiers)) {
      return;
    }

    if (this.viewRouteGestures.move(planPoint, modifiers)) {
      return;
    }

    this.updateViewPathHover(planPoint);
  }

  /**
   * View mode's idle hover over the selected polyline's squares — a path's or
   * a trench's, whichever is selected; other modes clear it.
   */
  private updateViewPathHover(planPoint: Vector2): void {
    if (this.store.editorMode.kind !== 'view') {
      this.store.setPathHandleHighlight(undefined);

      return;
    }

    if (!isNil(this.store.utilities.selectedUtilityRoute)) {
      applyRouteHandleHover(this.context, planPoint, { includeMidpoints: false });

      return;
    }

    applyPathHandleHover(this.context, planPoint, { includeMidpoints: false });
  }

  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): void {
    const interaction = this.currentEditInteraction();

    if (!isNil(interaction) && interaction.onPointerUp(planPoint, modifiers)) {
      return;
    }

    if (this.viewObjects.release(planPoint, modifiers)) {
      return;
    }

    if (
      this.viewPathGestures.release(planPoint, modifiers) ||
      this.viewRouteGestures.release(planPoint, modifiers)
    ) {
      // The grip is released: whatever the pointer rests on now is a hover.
      this.updateViewPathHover(planPoint);
    }
  }

  onPointerCancel(): void {
    this.currentEditInteraction()?.onPointerCancel();
    this.store.setDraftShape(undefined);
    this.store.setDraftMark(undefined);
    this.store.setActiveKeyPointSnap(undefined);

    this.viewObjects.cancel();
    this.viewPathGestures.cancel();
    this.viewRouteGestures.cancel();
    this.store.setPathHandleHighlight(undefined);
  }

  onPointerLeave(): void {
    this.store.view.setCursorPlanPoint(undefined);
    this.store.setPathHandleHighlight(undefined);
  }

  /** Ctrl/Cmd+D: copies whatever is selected, one grid step along. */
  duplicateSelected(): void {
    this.onPointerCancel();
    this.store.duplicateSelected();
  }

  onKeyDown(key: string, modifiers: PlanModifiers): boolean {
    // The wall-junction break UI owns the keyboard while a junction is
    // selected: its `s`/`d`/digits would otherwise arm the stair and duct
    // tools before the interaction ever saw them.
    if (!isNil(this.store.walls.selectedJunction)) {
      const editInteraction = this.currentEditInteraction();

      if (!isNil(editInteraction) && editInteraction.onKeyDown(key, modifiers)) {
        return true;
      }
    }

    const tool = TOOL_HOTKEYS[key.toLowerCase()];

    if (!isNil(tool)) {
      if (!isToolAllowed(this.store.editorMode, tool)) {
        return false;
      }

      this.onPointerCancel();
      this.store.setActiveTool(tool);

      return true;
    }

    const editorTool = editorToolForHotkey(this.store.editorMode, key.toLowerCase());

    if (!isNil(editorTool)) {
      this.onPointerCancel();
      this.store.setActiveTool(editorTool);

      return true;
    }

    if (key === CANCEL_KEY) {
      this.cancelOneLevel();

      return true;
    }

    if (key === COMMIT_KEY && this.store.siteObjects.draftPathPoints.length > 0) {
      this.store.siteObjects.commitDraftPath();

      return true;
    }

    if (key === COMMIT_KEY && this.store.utilities.draftUtilityPoints.length > 0) {
      this.store.utilities.commitDraftUtilityRoute();

      return true;
    }

    const interaction = this.currentEditInteraction();

    if (!isNil(interaction) && interaction.onKeyDown(key, modifiers)) {
      return true;
    }

    if (key === ENTER_MODE_KEY) {
      return this.enterSelectionEditMode();
    }

    if (DELETE_KEYS.has(key)) {
      // An open editor already took its own Delete above (a path's point);
      // what is left is the selected whole object, in any mode.
      this.store.removeSelected();

      return true;
    }

    return false;
  }

  /**
   * The Escape ladder — one level per press, nothing committed is lost: the
   * gesture or draft in flight, then the editor's own sub-selection, then the
   * selection, and only from a quiet editor the mode itself.
   */
  private cancelOneLevel(): void {
    if (this.hasTransientInteraction()) {
      this.cancelTransients();

      return;
    }

    const interaction = this.currentEditInteraction();

    if (!isNil(interaction) && interaction.onEscapeStep()) {
      return;
    }

    if (!isNil(this.store.selection)) {
      this.store.setSelection(undefined);

      return;
    }

    if (this.store.editorMode.kind === 'edit') {
      this.store.exitEditMode();
    }
  }

  private hasTransientInteraction(): boolean {
    const interaction = this.currentEditInteraction();

    return (
      (!isNil(interaction) && interaction.hasTransientInteraction()) ||
      this.viewObjects.hasActive() ||
      this.viewPathGestures.hasActive() ||
      this.viewRouteGestures.hasActive() ||
      this.store.siteObjects.draftPathPoints.length > 0 ||
      this.store.utilities.draftUtilityPoints.length > 0 ||
      this.store.measurePoints.length > 0
    );
  }

  private cancelTransients(): void {
    this.onPointerCancel();
    this.currentEditInteraction()?.cancelTransients();
    this.store.setMeasurePoints([]);
    this.store.siteObjects.cancelDraftPath();
    this.store.utilities.cancelDraftUtilityRoute();
  }

  /** Enter descends into the selected object's editor, when it has one. */
  private enterSelectionEditMode(): boolean {
    const { editorMode, selection } = this.store;

    if (editorMode.kind !== 'view' || isNil(selection)) {
      return false;
    }

    const door = editorDoorFor(selection);

    if (isNil(door)) {
      return false;
    }

    this.cancelTransients();
    this.store.openEditorDoor(door);

    return true;
  }

  /**
   * The double click is the mode door (see `modes.md`): in view mode it opens
   * the editor of what it lands on; inside a mode the open editor decides —
   * a path's removes a point over one, and every editor steps back out over
   * emptiness. Finishing a drawn polyline still comes first.
   */
  onDoubleClick(planPoint: Vector2, modifiers: PlanModifiers): void {
    if (this.store.siteObjects.draftPathPoints.length > 0) {
      this.store.siteObjects.commitDraftPath();

      return;
    }

    if (this.store.utilities.draftUtilityPoints.length > 0) {
      this.store.utilities.commitDraftUtilityRoute();

      return;
    }

    const interaction = this.currentEditInteraction();

    if (!isNil(interaction)) {
      interaction.onDoubleClick(planPoint, modifiers);

      return;
    }

    const viewport = this.getViewport();
    // A trench is a hairline over the ribbons, so its door answers first.
    const route = pickUtilityRoute(this.store, viewport, planPoint);

    if (!isNil(route)) {
      this.store.openEditorDoor({
        target: { kind: 'utilityRoute', routeId: route.id },
        aimAt: undefined,
      });

      return;
    }

    const path = pickPath(this.store, viewport, planPoint);

    if (!isNil(path)) {
      this.store.openEditorDoor({ target: { kind: 'path', pathId: path.id }, aimAt: undefined });

      return;
    }

    const picked = pickShape(this.store, viewport, planPoint);

    if (!isNil(picked)) {
      // A building opens its own editor; the plot opens site editing. The
      // footprint's shapes stay behind the site editor's door either way.
      this.store.openEditorDoor(
        picked.owner === 'boundary'
          ? { target: { kind: 'site' }, aimAt: undefined }
          : { target: { kind: 'building', buildingId: picked.owner }, aimAt: undefined }
      );
    }
  }

  /**
   * A restore replaces the very shape a gesture would commit, so whatever is in
   * flight is dropped first rather than written over the restored plan.
   */
  onUndo(): void {
    this.onPointerCancel();
    this.store.undo();
  }

  onRedo(): void {
    this.onPointerCancel();
    this.store.redo();
  }

  /** Drops the transient editor state the controller put in the store. */
  dispose(): void {
    this.onPointerCancel();
    this.onPointerLeave();
  }

  /**
   * The open editor's canvas behaviour, created the first time the mode is
   * seen and dropped with it — `enterEditMode` mints a fresh mode object, so a
   * reference compare is a mode-visit compare, and in-flight gestures never
   * survive into another editor.
   */
  private currentEditInteraction(): EditorInteraction | undefined {
    const mode = this.store.editorMode;

    if (mode.kind !== 'edit') {
      this.editInteraction = undefined;

      return undefined;
    }

    if (isNil(this.editInteraction) || this.editInteraction.mode !== mode) {
      this.editInteraction = { mode, interaction: this.createEditInteraction(mode.target) };
    }

    return this.editInteraction.interaction;
  }

  private createEditInteraction(target: EditTarget): EditorInteraction {
    switch (target.kind) {
      case 'site':
        return new SiteEditInteraction(this.context);
      case 'path':
        return new PathEditInteraction(this.context, target.pathId);
      case 'utilityRoute':
        return new RouteEditInteraction(this.context, target.routeId);
      case 'building':
        return new BuildingEditInteraction(this.context, target.buildingId);
      default:
        return assertNever(target);
    }
  }

  /**
   * What view mode's select takes hold of, nearest grip first: the selected
   * car's turn grip, a selected path's point squares, then the whole object
   * under the pointer.
   */
  private beginViewSelectGesture(planPoint: Vector2): void {
    if (
      this.beginCarRotation(planPoint) ||
      this.beginBuildingRotation(planPoint) ||
      this.viewPathGestures.begin(planPoint, { allowInsert: false }) ||
      this.viewRouteGestures.begin(planPoint, { allowInsert: false })
    ) {
      return;
    }

    const object = pickSiteObject(this.store, this.getViewport(), planPoint);

    if (isNil(object)) {
      this.store.setSelection(undefined);

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
  private beginPlacementGesture(planPoint: Vector2, modifiers: PlanModifiers): void {
    if (this.beginCarRotation(planPoint)) {
      return;
    }

    const object = pickPlacedInstance(this.store, this.getViewport(), planPoint);

    if (!isNil(object)) {
      this.beginObjectDrag(object, planPoint);

      return;
    }

    this.store.siteObjects.placeSelectedObject(snapPointToGrid(this.store, planPoint, modifiers));
    this.store.finishPlacement();
  }

  /**
   * Takes hold of the object under the pointer as one whole thing: selects it,
   * and — when its kind moves in view mode (`SITE_OBJECT_TRAITS`) — starts the
   * drag that slides all of it, whatever its internal anatomy.
   */
  private beginObjectDrag(object: SiteObjectState, planPoint: Vector2): void {
    this.store.setSelection(siteObjectSelection(object));

    if (!SITE_OBJECT_TRAITS[object.kind].isMovable) {
      return;
    }

    const startReference = siteObjectReference(object);

    if (isNil(startReference)) {
      return;
    }

    // Slides the object rigidly, its reference point snapped to the grid.
    this.viewObjects.beginMove(
      {
        origin: startReference,
        moveTo: (draggedPoint, modifiers) => {
          const reference = snapPointToGrid(this.store, draggedPoint, modifiers);

          this.store.siteObjects.applySiteObject(
            translateSiteObject(object, {
              x: reference.x - startReference.x,
              y: reference.y - startReference.y,
            })
          );
        },
        restore: () => this.store.siteObjects.applySiteObject(object),
      },
      planPoint
    );
  }

  /**
   * A trench click lands on the entry it is within reach of — the site run and
   * the indoor run must actually meet at the seam — and on the grid otherwise.
   */
  private snapUtilityPoint(planPoint: Vector2, modifiers: PlanModifiers): Vector2 {
    const withinMeters = ENTRY_SNAP_RADIUS_PX / this.getViewport().pixelsPerMeter;
    const entryPoint = this.store.utilities.nearestEntryPoint(
      planPoint,
      withinMeters,
      this.store.utilities.nextUtilitySystem
    );

    return entryPoint ?? snapPointToGrid(this.store, planPoint, modifiers);
  }

  /**
   * The grip over the selected building's footprint turns the WHOLE house —
   * storeys, furniture and the roof ridge together. View mode only: inside an
   * editor the building is being worked on, not arranged.
   */
  private beginBuildingRotation(planPoint: Vector2): boolean {
    const building = this.store.building.selectedBuilding;

    if (isNil(building) || this.store.editorMode.kind !== 'view') {
      return false;
    }

    const scene = this.store.scene.buildingScenes.find(
      candidate => candidate.building.id === building.id
    );
    const bounds = isNil(scene) ? undefined : computeMultiPolygonBounds(scene.polygons);

    if (isNil(scene) || isNil(bounds)) {
      return false;
    }

    const viewport = this.getViewport();
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
    return this.viewObjects.beginRotate(
      {
        origin: pivot,
        startRotationDegrees: 0,
        turnTo: degrees => this.store.building.turnWholeBuilding(building, degrees),
        restore: () => this.store.building.turnWholeBuilding(building, 0),
      },
      planPoint
    );
  }

  private beginCarRotation(planPoint: Vector2): boolean {
    const car = this.store.siteObjects.selectedCar;

    if (isNil(car)) {
      return false;
    }

    const viewport = this.getViewport();
    const handle = findHandleAt(
      computeCarHandles(car, viewport),
      planToScreen(viewport, planPoint)
    );

    if (isNil(handle)) {
      return false;
    }

    return this.viewObjects.beginRotate(
      {
        origin: car.position,
        startRotationDegrees: car.rotationDegrees,
        turnTo: rotationDegrees => this.store.siteObjects.updateCar({ ...car, rotationDegrees }),
        restore: () => this.store.siteObjects.updateCar(car),
      },
      planPoint
    );
  }
}
