import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from '../../domain/model/building';
import type { BuildingLayerId } from '../../domain/model/building-layers';
import { isSelectionOnLayer, layerOfSelection } from '../../domain/model/building-layers';
import type { Selection } from '../../domain/model/selection';
import type { Wall } from '../../domain/model/walls';
import type { WiringRoute } from '../../domain/model/wiring-routes';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { handleDraftKey } from './building-draft-keys';
import type { BuildingGrip, BuildingGrips } from './building-grips';
import { createBuildingGrips, pickAcrossLayers } from './building-grips';
import { placeWithBuildingTool } from './building-tool-placement';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { ObjectDragGestures } from './object-drag-gestures';
import type { PolylinePointGestures } from './polyline-point-gestures';
import { SlabGestures } from './slab-gestures';
import { pickWall } from './storey-object-picking';
import { editWallCornerAt, sealRingIfEndsMeet } from './wall-corner-edits';
import { WallJunctionDetach } from './wall-junction-detach';
import { applyWallHandleHover, createWallPointGestures } from './wall-point-gestures';
import {
  applyWiringRouteHandleHover,
  createWiringRoutePointGestures,
  removeRoutePointAt,
} from './wiring-route-point-gestures';

/**
 * The building editor's canvas behaviour: the tools place what they place, the
 * select tool takes hold of whatever stands on the storey — walls and their
 * corners, the objects on the floor (`building-grips.ts`), the slabs — and the
 * keyboard edits the selected wall junction (`wall-junction-detach.ts`).
 *
 * Only the ACTIVE layer answers the select tool (`layers.md` §6.7): a press
 * passes through whatever the other layers show, so the walls under a sofa
 * are context while the furniture is being arranged, not a competing target.
 */
export class BuildingEditInteraction implements EditorInteraction {
  private readonly context: InteractionContext;
  private readonly buildingId: BuildingId;
  private readonly wallGestures: PolylinePointGestures<Wall>;
  private readonly routeGestures: PolylinePointGestures<WiringRoute>;
  private readonly slabs: SlabGestures;
  private readonly objects: ObjectDragGestures;
  private readonly grips: BuildingGrips;
  private readonly junction: WallJunctionDetach;

  constructor(context: InteractionContext, buildingId: BuildingId) {
    this.context = context;
    this.buildingId = buildingId;
    this.wallGestures = createWallPointGestures(context, buildingId);
    this.routeGestures = createWiringRoutePointGestures(context);
    this.objects = new ObjectDragGestures(context);
    this.grips = createBuildingGrips(context, buildingId);
    this.junction = new WallJunctionDetach(context, buildingId);
    this.slabs = new SlabGestures(context, buildingId);
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    if (this.isLayerActive('walls') && this.junction.plant(planPoint, modifiers)) {
      return true;
    }

    switch (store.activeTool) {
      case 'select':
        // A press re-aims the break UI: the junction it lands on re-selects
        // on release, any other target leaves no junction selected.
        store.walls.selectJunction(undefined);
        this.beginSelectGesture(planPoint, modifiers);

        return true;
      default:
        return placeWithBuildingTool(
          this.context,
          this.buildingId,
          this.slabs,
          planPoint,
          modifiers
        );
    }
  }

  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (
      this.junction.move(planPoint, modifiers) ||
      this.objects.move(planPoint, modifiers) ||
      this.slabs.move(planPoint, modifiers) ||
      this.wallGestures.move(planPoint, modifiers) ||
      this.routeGestures.move(planPoint, modifiers)
    ) {
      return true;
    }

    if (
      this.isLayerActive('electrical') &&
      this.context.store.activeTool === 'select' &&
      !isNil(this.context.store.electrics.wiring.selectedRoute)
    ) {
      applyWiringRouteHandleHover(this.context, planPoint);

      return true;
    }

    // With the select tool idle over the selected wall, the handles announce
    // themselves — and the event is spent, or the shell would clear the hover.
    if (
      this.isLayerActive('walls') &&
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

    if (this.routeGestures.release(planPoint, modifiers)) {
      applyWiringRouteHandleHover(this.context, planPoint);

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
    this.routeGestures.cancel();
  }

  /**
   * Commits the polyline being clicked out; on a corner of the selected wall
   * it edits the contour — plain removes the corner, Alt CUTS there (a ring
   * opens, an open wall splits in two); on an object of another layer it
   * steps into that layer with the object selected (`layers.md` §7 п.6 — the
   * Illustrator isolation habit, «double-click means deeper»); over emptiness
   * it closes the editor.
   */
  onDoubleClick(planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;

    if (store.wallDraft.draftWallPoints.length > 0) {
      store.wallDraft.commitDraftWall();

      return;
    }

    if (store.electrics.wiring.draftRoutePoints.length > 0) {
      store.electrics.wiring.commitDraftRoute();

      return;
    }

    if (
      this.isLayerActive('walls') &&
      editWallCornerAt(this.context, this.buildingId, this.wallGestures, planPoint, modifiers)
    ) {
      return;
    }

    if (
      this.isLayerActive('electrical') &&
      removeRoutePointAt(this.context, this.routeGestures, planPoint, modifiers)
    ) {
      return;
    }

    const underPointer = pickAcrossLayers(this.context, this.buildingId, this.grips, planPoint);

    if (isNil(underPointer)) {
      store.exitEditMode();

      return;
    }

    const layer = layerOfSelection(underPointer);

    if (!isNil(layer) && layer !== store.layers.activeLayer) {
      store.layers.setActiveLayer(layer);
      store.setSelection(underPointer);
    }
  }

  onKeyDown(key: string, _modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    if (this.isLayerActive('walls') && this.junction.onKey(key)) {
      return true;
    }

    return handleDraftKey(store, key);
  }

  onEscapeStep(): boolean {
    return false;
  }

  hasTransientInteraction(): boolean {
    return (
      this.wallGestures.hasActive() ||
      this.routeGestures.hasActive() ||
      this.objects.hasActive() ||
      this.slabs.hasActive() ||
      this.junction.hasActive() ||
      !isNil(this.context.store.electrics.pendingConnectDeviceId) ||
      this.context.store.wallDraft.draftWallPoints.length > 0 ||
      this.context.store.electrics.wiring.draftRoutePoints.length > 0
    );
  }

  cancelTransients(): void {
    this.onPointerCancel();
    this.context.store.wallDraft.cancelDraftWall();
    this.context.store.electrics.wiring.cancelDraftRoute();
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
    const isWallsLayer = this.isLayerActive('walls');
    const isStructureLayer = this.isLayerActive('structure');
    const isElectricalLayer = this.isLayerActive('electrical');

    if (
      (isStructureLayer && this.slabs.beginHandle(planPoint)) ||
      (isElectricalLayer && this.routeGestures.begin(planPoint, { allowInsert: true })) ||
      this.grab(this.grips.overWalls, planPoint, modifiers) ||
      (isWallsLayer && this.wallGestures.begin(planPoint, { allowInsert: true })) ||
      this.grab(this.grips.underWalls, planPoint, modifiers)
    ) {
      return;
    }

    const wall = isWallsLayer ? pickWall(this.context, this.buildingId, planPoint) : undefined;

    if (!isNil(wall)) {
      this.context.store.setSelection({
        kind: 'wall',
        buildingId: this.buildingId,
        wallId: wall.id,
      });

      return;
    }

    if (
      !isStructureLayer ||
      !this.slabs.beginDrag(planPoint, slab =>
        this.select({ kind: 'slab', buildingId: this.buildingId, slabId: slab.id }, modifiers)
      )
    ) {
      this.context.store.setSelection(undefined);
    }
  }

  private isLayerActive(layer: BuildingLayerId): boolean {
    return this.context.store.layers.activeLayer === layer;
  }

  /**
   * The first grip that answers the press takes hold: selects, then starts its
   * gesture. A grip of another layer is passed over, so the press reaches what
   * the active layer has underneath.
   */
  private grab(
    grips: readonly BuildingGrip[],
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): boolean {
    const activeLayer = this.context.store.layers.activeLayer;

    for (const grip of grips) {
      const grab = grip(planPoint);

      if (
        isNil(grab) ||
        (!isNil(activeLayer) && !isSelectionOnLayer(grab.selection, activeLayer))
      ) {
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
