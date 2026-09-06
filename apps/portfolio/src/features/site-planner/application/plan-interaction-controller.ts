import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { EditorMode, EditTarget } from '../domain/model/editor-mode';
import { isPlanTool } from '../domain/model/editor-mode';
import type { PlanInputTarget, PlanModifiers } from '../domain/view/plan-input';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { BuildingEditInteraction } from './interactions/building-edit-interaction';
import { openEditorDoorAt } from './interactions/editor-doors';
import type { EditorInteraction, InteractionContext } from './interactions/editor-interaction';
import { snapPointToGrid } from './interactions/grid-snapping';
import { PathEditInteraction } from './interactions/path-edit-interaction';
import { PlanKeyboardCommands } from './interactions/plan-keyboard-commands';
import { RouteEditInteraction } from './interactions/route-edit-interaction';
import { ENTRY_SNAP_RADIUS_PX } from './interactions/route-point-gestures';
import { SiteEditInteraction } from './interactions/site-edit-interaction';
import { ViewModeGestures } from './interactions/view-mode-gestures';
import type { SitePlannerStore } from './SitePlannerStore';

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
  /** What the select and placing tools take hold of while viewing ({@link ViewModeGestures}). */
  private readonly viewGestures: ViewModeGestures;
  private readonly keyboard: PlanKeyboardCommands;
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
    this.viewGestures = new ViewModeGestures(this.context);
    this.keyboard = new PlanKeyboardCommands(store, {
      currentEditInteraction: () => this.currentEditInteraction(),
      hasActiveViewGesture: () => this.viewGestures.hasActive(),
      onPointerCancel: () => this.onPointerCancel(),
    });
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
        this.viewGestures.beginSelect(planPoint);

        return;
      case 'measure':
        this.store.tooling.setMeasurePoints([
          ...this.store.measurePoints,
          snapPointToGrid(this.store, planPoint, modifiers),
        ]);

        return;
      case 'tree':
        this.viewGestures.beginPlacement(planPoint, modifiers);

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

    if (this.viewGestures.move(planPoint, modifiers)) {
      return;
    }

    this.viewGestures.updateHover(planPoint);
  }

  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): void {
    const interaction = this.currentEditInteraction();

    if (!isNil(interaction) && interaction.onPointerUp(planPoint, modifiers)) {
      return;
    }

    if (this.viewGestures.releaseObject(planPoint, modifiers)) {
      return;
    }

    if (this.viewGestures.releasePolyline(planPoint, modifiers)) {
      this.viewGestures.updateHover(planPoint);
    }
  }

  onPointerCancel(): void {
    this.currentEditInteraction()?.onPointerCancel();
    this.store.tooling.setDraftShape(undefined);
    this.store.tooling.setDraftMark(undefined);
    this.store.tooling.setActiveKeyPointSnap(undefined);

    this.viewGestures.cancel();
    this.store.tooling.setPathHandleHighlight(undefined);
  }

  onPointerLeave(): void {
    this.store.view.setCursorPlanPoint(undefined);
    this.store.tooling.setPathHandleHighlight(undefined);
  }

  /** Ctrl/Cmd+D: copies whatever is selected, one grid step along. */
  duplicateSelected(): void {
    this.onPointerCancel();
    this.store.selectionCommands.duplicateSelected();
  }

  /**
   * The double click is the mode door (see `modes.md`): in view mode it opens
   * the editor of what it lands on; inside a mode the open editor decides —
   * a path's removes a point over one, and every editor steps back out over
   * emptiness. Finishing a drawn polyline still comes first.
   */
  onKeyDown(key: string, modifiers: PlanModifiers): boolean {
    return this.keyboard.onKeyDown(key, modifiers);
  }

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

    openEditorDoorAt(this.store, this.getViewport(), planPoint);
  }

  /**
   * A restore replaces the very shape a gesture would commit, so whatever is in
   * flight is dropped first rather than written over the restored plan.
   */
  onUndo(): void {
    this.onPointerCancel();
    this.store.document.undo();
  }

  onRedo(): void {
    this.onPointerCancel();
    this.store.document.redo();
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
}
