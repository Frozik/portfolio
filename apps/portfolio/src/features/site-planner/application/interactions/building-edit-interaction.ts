import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { TYPED_LENGTH_KEY_PATTERN } from '../../domain/geometry/draw-constraints';
import type { BuildingId } from '../../domain/model/building';
import type { Selection } from '../../domain/model/selection';
import type { Wall } from '../../domain/model/walls';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { BuildingGrip, BuildingGrips } from './building-grips';
import { createBuildingGrips } from './building-grips';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { snapPointToGrid } from './grid-snapping';
import { ObjectDragGestures } from './object-drag-gestures';
import type { PolylinePointGestures } from './polyline-point-gestures';
import { SlabGestures } from './slab-gestures';
import { pickWall } from './storey-object-picking';
import { connectDeviceAt, placeDeviceAt, placeOpeningAt } from './storey-object-placement';
import { editWallCornerAt, sealRingIfEndsMeet } from './wall-corner-edits';
import { WallJunctionDetach } from './wall-junction-detach';
import { applyWallHandleHover, createWallPointGestures } from './wall-point-gestures';

/**
 * The building editor's canvas behaviour: the tools place what they place, the
 * select tool takes hold of whatever stands on the storey — walls and their
 * corners, the objects on the floor (`building-grips.ts`), the slabs — and the
 * keyboard edits the selected wall junction (`wall-junction-detach.ts`).
 */
export class BuildingEditInteraction implements EditorInteraction {
  private readonly context: InteractionContext;
  private readonly buildingId: BuildingId;
  private readonly wallGestures: PolylinePointGestures<Wall>;
  private readonly slabs: SlabGestures;
  private readonly objects: ObjectDragGestures;
  private readonly grips: BuildingGrips;
  private readonly junction: WallJunctionDetach;

  constructor(context: InteractionContext, buildingId: BuildingId) {
    this.context = context;
    this.buildingId = buildingId;
    this.wallGestures = createWallPointGestures(context, buildingId);
    this.objects = new ObjectDragGestures(context);
    this.grips = createBuildingGrips(context, buildingId);
    this.junction = new WallJunctionDetach(context, buildingId);
    this.slabs = new SlabGestures(context, buildingId);
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    if (this.junction.plant(planPoint, modifiers)) {
      return true;
    }

    switch (store.activeTool) {
      case 'select':
        // A press re-aims the break UI: the junction it lands on re-selects
        // on release, any other target leaves no junction selected.
        store.walls.selectJunction(undefined);
        this.beginSelectGesture(planPoint, modifiers);

        return true;
      case 'building:wall':
        // The ground storey stands on the foundation, so a click past the
        // slab lands on its edge; an upper storey may overhang (R24).
        // `draftWallCursor` is the previewed corner — angle lock and typed
        // length included — so what the rubber band showed is what lands.
        store.wallDraft.appendDraftWallPoint(
          store.walls.clampWallPoint(
            this.buildingId,
            store.wallDraft.draftWallCursor ?? store.wallDraft.firstWallPointAt(planPoint)
          )
        );
        store.wallDraft.setTypedLengthText(undefined);

        return true;
      case 'building:opening':
        // Nothing lands when the click missed every wall, and a tool that
        // placed nothing must stay in hand rather than quietly give up.
        if (placeOpeningAt(this.context, this.buildingId, planPoint)) {
          store.tooling.finishPlacement();
        }

        return true;
      case 'building:slab':
        // Drawn like any shape on the plot — the armed primitive, dragged out.
        // A click that never moved lays a plate of a sensible default size, so
        // the tool answers both ways of asking for a floor.
        this.slabs.beginDraw(planPoint, modifiers);

        return true;
      case 'building:fireplace':
        store.ducts.placeFireplaceAt(snapPointToGrid(store, planPoint, modifiers));
        store.tooling.finishPlacement();

        return true;
      case 'building:duct':
        store.ducts.placeDuctAt(snapPointToGrid(store, planPoint, modifiers));
        store.tooling.finishPlacement();

        return true;
      case 'building:support':
        store.storeyObjects.placeSupportAt(snapPointToGrid(store, planPoint, modifiers));
        store.tooling.finishPlacement();

        return true;
      case 'building:stair':
        // A stair is placed, not drawn: its run comes from the storey height,
        // so the click only says where.
        store.stairs.placeStairAt(snapPointToGrid(store, planPoint, modifiers));
        store.tooling.finishPlacement();

        return true;
      // Furniture and electrics are STICKY: a room is furnished and a storey
      // wired by placing one piece after another, so these two tools stay in
      // hand. The piece that lands is still selected, so its properties are
      // there to type — only the tool is not taken away.
      case 'building:furniture':
        store.furniture.placeFurnitureAt(
          this.buildingId,
          snapPointToGrid(store, planPoint, modifiers)
        );

        return true;
      case 'building:electric':
        placeDeviceAt(this.context, this.buildingId, planPoint, modifiers);

        return true;
      case 'building:connect':
        connectDeviceAt(this.context, this.buildingId, planPoint);

        return true;
      default:
        return false;
    }
  }

  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (
      this.junction.move(planPoint, modifiers) ||
      this.objects.move(planPoint, modifiers) ||
      this.slabs.move(planPoint, modifiers) ||
      this.wallGestures.move(planPoint, modifiers)
    ) {
      return true;
    }

    // With the select tool idle over the selected wall, the handles announce
    // themselves — and the event is spent, or the shell would clear the hover.
    if (
      this.context.store.activeTool === 'select' &&
      !isNil(this.context.store.walls.selectedWall)
    ) {
      applyWallHandleHover(this.context, planPoint);

      return true;
    }

    return false;
  }

  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (this.objects.release(planPoint, modifiers)) {
      return true;
    }

    if (this.slabs.release(planPoint, modifiers)) {
      return true;
    }

    if (!this.wallGestures.release(planPoint, modifiers)) {
      return false;
    }

    // A dragged endpoint that landed on its opposite end has closed the
    // contour; the release is what seals the ring.
    sealRingIfEndsMeet(this.context, this.buildingId);
    applyWallHandleHover(this.context, planPoint);

    return true;
  }

  onPointerCancel(): void {
    this.junction.cancel();
    this.objects.cancel();
    this.slabs.cancel();
    this.wallGestures.cancel();
  }

  /**
   * Commits the polyline being clicked out; on a corner of the selected wall
   * it edits the contour — plain removes the corner, Alt CUTS there (a ring
   * opens, an open wall splits in two); over emptiness it closes the editor.
   */
  onDoubleClick(planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;

    if (store.wallDraft.draftWallPoints.length > 0) {
      store.wallDraft.commitDraftWall();

      return;
    }

    if (editWallCornerAt(this.context, this.buildingId, this.wallGestures, planPoint, modifiers)) {
      return;
    }

    if (isNil(pickWall(this.context, this.buildingId, planPoint))) {
      store.exitEditMode();
    }
  }

  onKeyDown(key: string, _modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    if (this.junction.onKey(key)) {
      return true;
    }

    if (key === 'Enter' && store.wallDraft.draftWallPoints.length > 0) {
      store.wallDraft.commitDraftWall();

      return true;
    }

    if (store.wallDraft.draftWallPoints.length === 0) {
      return false;
    }

    // The CAD value-control box: aim roughly, then state the length. Digits
    // and one separator accumulate; Backspace peels the number back and, once
    // it is empty, takes the last corner with it.
    if (TYPED_LENGTH_KEY_PATTERN.test(key)) {
      store.wallDraft.appendTypedLengthKey(key);

      return true;
    }

    if (key === 'Backspace') {
      if (isNil(store.wallDraft.typedLengthText)) {
        store.wallDraft.dropLastDraftWallPoint();
      } else {
        store.wallDraft.setTypedLengthText(undefined);
      }

      return true;
    }

    return false;
  }

  onEscapeStep(): boolean {
    return false;
  }

  hasTransientInteraction(): boolean {
    return (
      this.wallGestures.hasActive() ||
      this.objects.hasActive() ||
      this.slabs.hasActive() ||
      this.junction.hasActive() ||
      !isNil(this.context.store.electrics.pendingConnectDeviceId) ||
      this.context.store.wallDraft.draftWallPoints.length > 0
    );
  }

  cancelTransients(): void {
    this.onPointerCancel();
    this.context.store.wallDraft.cancelDraftWall();
    this.context.store.electrics.setPendingConnectDeviceId(undefined);
  }

  /**
   * What the select tool takes hold of, nearest grip first: the slab's grips,
   * the grips and small things drawn over the walls, a corner of the selected
   * wall, then the objects standing among the walls, then a wall's body — and
   * the floor last: everything on a storey stands on it, so a slab that
   * answered first would swallow every click meant for empty floor.
   */
  private beginSelectGesture(planPoint: Vector2, modifiers: PlanModifiers): void {
    if (
      this.slabs.beginHandle(planPoint) ||
      this.grab(this.grips.overWalls, planPoint, modifiers) ||
      this.wallGestures.begin(planPoint, { allowInsert: true }) ||
      this.grab(this.grips.underWalls, planPoint, modifiers)
    ) {
      return;
    }

    const wall = pickWall(this.context, this.buildingId, planPoint);

    if (!isNil(wall)) {
      this.context.store.setSelection({
        kind: 'wall',
        buildingId: this.buildingId,
        wallId: wall.id,
      });

      return;
    }

    if (
      !this.slabs.beginDrag(planPoint, slab =>
        this.select({ kind: 'slab', buildingId: this.buildingId, slabId: slab.id }, modifiers)
      )
    ) {
      this.context.store.setSelection(undefined);
    }
  }

  /** The first grip that answers the press takes hold: selects, then starts its gesture. */
  private grab(
    grips: readonly BuildingGrip[],
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): boolean {
    for (const grip of grips) {
      const grab = grip(planPoint);

      if (isNil(grab)) {
        continue;
      }

      this.select(grab.selection, modifiers);

      return grab.gesture === 'rotate'
        ? this.objects.beginRotate(grab.dragged, planPoint)
        : this.objects.beginMove(grab.dragged, planPoint);
    }

    return false;
  }

  /**
   * Selects, or — with Shift — adds to what is already selected. One helper so
   * every body in this editor answers the modifier the same way.
   */
  private select(selection: Selection, modifiers: PlanModifiers): void {
    const { store } = this.context;

    if (modifiers.isShiftPressed) {
      store.selectionCommands.toggleSelection(selection);

      return;
    }

    store.setSelection(selection);
  }
}
