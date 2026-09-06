import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import { getShapeKeyPoints } from '../domain/geometry/shape-key-points';
import { setRectangleRotation } from '../domain/geometry/transform-shape';
import type { BuildingId } from '../domain/model/building';
import type { Selection } from '../domain/model/selection';
import type { ShapeId } from '../domain/model/shapes';
import { isBoxedShape } from '../domain/model/shapes';
import type { Slab } from '../domain/model/slabs';
import { createSlab, NO_SLABS } from '../domain/model/slabs';
import {
  addStoreyObject,
  findStoreyObject,
  updateStoreyObject,
} from '../domain/model/storey-edits';
import { selectedStoreyObject } from '../domain/model/storey-object-selection';
import { SLAB_OBJECTS, SUPPORT_OBJECTS } from '../domain/model/storey-objects';
import type { SupportId, SupportPost } from '../domain/model/supports';
import { createSupport } from '../domain/model/supports';
import { QUARTER_TURN_DEGREES } from '../domain/units';
import { wallSnapPoints } from '../domain/view/object-snapping';
import type { PlanEditorCore } from './editor-core';
import type { SceneModel } from './SceneModel';
import { takeStoreyObjectAway } from './storey-object-removal';
import type { StoreysModel } from './StoreysModel';

/**
 * What stands INSIDE the open building, storey by storey: the posts and the
 * slabs — placed, dragged, turned and taken away through the storey-object
 * registry — and the removal every storey object shares. Stairs live in
 * {@link StairsModel}, fireplaces and shafts in {@link DuctsModel}, furniture
 * in {@link FurnitureModel}, the electrics in {@link ElectricsModel}.
 */
const NO_SNAP_POINTS: readonly Vector2[] = [];

/** Every corner of an outline — what a floor is aligned to when no wall is. */
function outlineCorners(polygons: MultiPolygon): readonly Vector2[] {
  return polygons.flatMap(polygon => [polygon.outer, ...polygon.holes].flat());
}

export class StoreyObjectsEditorModel {
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;
  private readonly storeys: StoreysModel;

  constructor(core: PlanEditorCore, scene: SceneModel, storeys: StoreysModel) {
    this.core = core;
    this.scene = scene;
    this.storeys = storeys;

    makeAutoObservable<StoreyObjectsEditorModel, 'core' | 'scene' | 'storeys'>(
      this,
      { core: false, scene: false, storeys: false },
      { autoBind: true }
    );
  }

  /**
   * Puts a post where it was clicked. Both of its ends derive — the floor or
   * the graded ground beneath it, the storey's ceiling above — so a canopy on
   * a slope gets posts of the right, different lengths without anyone typing
   * a number.
   */
  placeSupportAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.storeys.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      SUPPORT_OBJECTS,
      createSupport({ position: planPoint })
    );
  }

  /**
   * Lays a slab where it was clicked — the floor of an upper storey, drawn as
   * an object rather than derived from the walls. A cantilevered second floor
   * needs a floor of its own to stand on, and walls are then held to it. The
   * plate that lands is a plain shape, so the tool that drew it can be any of
   * the primitives the plot itself is drawn with.
   */
  placeSlabAt(planPoint: Vector2): void {
    this.addSlab(createSlab(planPoint));
  }

  /** Puts a drawn slab on the active storey and selects it. */
  addSlab(slab: Slab): void {
    const session = this.core.editorSession;
    const storeyId = this.storeys.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      SLAB_OBJECTS,
      slab
    );
    this.core.setSelection({ kind: 'slab', buildingId: session.buildingId, slabId: slab.id });
  }

  /** Writes a slab back; a drag announced its own history step when it began. */
  updateSlab(buildingId: BuildingId, slab: Slab): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      SLAB_OBJECTS,
      slab.id,
      slab
    );
  }

  /** Turns a slab by a quarter, the way a stair or a table turns. */
  rotateSlabByQuarter(buildingId: BuildingId, slabId: ShapeId): void {
    const slab = findStoreyObject(this.core.buildings, buildingId, SLAB_OBJECTS, slabId);

    if (isNil(slab) || !isBoxedShape(slab)) {
      return;
    }

    this.core.pushHistory();
    this.updateSlab(
      buildingId,
      setRectangleRotation(slab, slab.rotationDegrees + QUARTER_TURN_DEGREES)
    );
  }

  removeSlabFrom(buildingId: BuildingId, slabId: ShapeId): void {
    takeStoreyObjectAway(this.core, 'slab', buildingId, slabId);
  }

  /** Slides a post; the drag announced its own history step when it began. */
  moveSupport(
    buildingId: BuildingId,
    supportId: SupportId,
    changes: Partial<Omit<SupportPost, 'id'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      SUPPORT_OBJECTS,
      supportId,
      changes
    );
  }

  removeSupportFrom(buildingId: BuildingId, supportId: SupportId): void {
    takeStoreyObjectAway(this.core, 'support', buildingId, supportId);
  }

  /**
   * What a slab is magnetised to while it is drawn, dragged or resized: the
   * corners and side middles of the walls STANDING BELOW it, the corners of the
   * storey below's own outline, its own storey's walls, and the other slabs of
   * that storey. Positioning a floor by eye against the rooms underneath is
   * hopeless — this is what makes «flush with the wall downstairs» a gesture.
   */
  slabSnapPoints(excludedShapeId: ShapeId): readonly Vector2[] {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return NO_SNAP_POINTS;
    }

    const scene = this.scene.buildingScenes.find(
      candidate => candidate.building.id === session.buildingId
    );
    const level = this.storeys.editedStoreyScene?.level;

    if (isNil(scene) || isNil(level)) {
      return NO_SNAP_POINTS;
    }

    const own = scene.storeys[level];
    const below = scene.storeys[level - 1];

    return [
      ...wallSnapPoints(own.storey.walls),
      ...own.slabs.filter(slab => slab.id !== excludedShapeId).flatMap(getShapeKeyPoints),
      ...(isNil(below)
        ? []
        : [...wallSnapPoints(below.storey.walls), ...outlineCorners(below.footprint)]),
    ];
  }

  /** The slabs of the storey being edited — the floor its walls are held to. */
  get activeStoreySlabs(): readonly Slab[] {
    return this.storeys.editedStoreyScene?.slabs ?? NO_SLABS;
  }

  removeSelectedStoreyObject(selection: Selection): void {
    const selected = selectedStoreyObject(selection);

    if (!isNil(selected)) {
      takeStoreyObjectAway(this.core, selected.selector.key, selected.buildingId, selected.id);
    }
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
