import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { clampPointToMultiPolygon } from '../domain/geometry/polygon-booleans';
import { slabsOutline } from '../domain/geometry/slab-geometry';
import type { BuildingId } from '../domain/model/building';
import { storeysOf } from '../domain/model/building';
import { findBuilding as findBuildingIn } from '../domain/model/building-edits';
import type { Selection } from '../domain/model/selection';
import { removeWallEdgeIn } from '../domain/model/wall-edge-removal';
import {
  closeWallRing as closeWallRingIn,
  cutWallAtPoint as cutWallAtPointIn,
  findWall as findWallIn,
  insertWallPoint as insertWallPointIn,
  moveWallPoint as moveWallPointIn,
  removeWall as removeWallFrom,
  removeWallPoint as removeWallPointIn,
  updateWall as updateWallIn,
} from '../domain/model/wall-edits';
import type { JunctionEdge } from '../domain/model/wall-topology';
import {
  junctionEdgesAt,
  junctionVerticesAt,
  moveWallJunctionIn,
  normalizeBuildingWallCrossings as normalizeBuildingWallCrossingsIn,
} from '../domain/model/wall-topology';
import type { Wall, WallId } from '../domain/model/walls';
import type { PlanEditorCore } from './editor-core';
import type { SceneModel } from './SceneModel';
import type { StoreyObjectsEditorModel } from './StoreyObjectsEditorModel';
import type { StoreysModel } from './StoreysModel';

/**
 * The committed walls of the open building: their point surgery, the
 * junction break UI and the clamps that keep a corner on its floor. The
 * polyline in flight lives in {@link WallDraftModel}, the doors and windows
 * in {@link OpeningsModel}; the walls themselves live in the document.
 */
const WALL_HISTORY_GROUP = 'wall';

const NO_SELECTIONS: readonly Selection[] = [];

export class WallEditorModel {
  /**
   * The junction the break UI is aimed at — a spot on the plan where wall
   * vertices coincide. Set by clicking a vertex handle; the numbered-edge
   * badges and the digit/D/S keys live only while this stands.
   */
  selectedJunction: Vector2 | undefined = undefined;
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;
  private readonly storeys: StoreysModel;
  private readonly storeyObjects: StoreyObjectsEditorModel;

  constructor(
    core: PlanEditorCore,
    scene: SceneModel,
    storeys: StoreysModel,
    storeyObjects: StoreyObjectsEditorModel
  ) {
    this.core = core;
    this.scene = scene;
    this.storeys = storeys;
    this.storeyObjects = storeyObjects;

    makeAutoObservable<WallEditorModel, 'core' | 'scene' | 'storeys' | 'storeyObjects'>(
      this,
      { core: false, scene: false, storeys: false, storeyObjects: false },
      { autoBind: true }
    );
  }

  /** The wall the selection names, when it still exists. */
  get selectedWall(): Wall | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'wall'
      ? undefined
      : findWallIn(this.core.buildings, selection.buildingId, selection.wallId);
  }

  /**
   * Edits a wall field by field. Typed numbers group per wall, so a burst of
   * keystrokes stays one step to undo.
   */
  updateWallProperties(
    buildingId: BuildingId,
    wallId: WallId,
    changes: Partial<Omit<Wall, 'id'>>
  ): void {
    this.core.pushHistory(`${WALL_HISTORY_GROUP}:${wallId}`);
    this.core.buildings = updateWallIn(this.core.buildings, buildingId, wallId, changes);
  }

  /**
   * The point held onto the foundation slab: itself while it stands on the
   * footprint, the nearest spot of the slab's edge otherwise — walls are not
   * drawn or dragged past what carries them (a building with no footprint yet
   * constrains nothing).
   */
  clampToFoundation(buildingId: BuildingId, point: Vector2): Vector2 {
    const scene = this.scene.buildingScenes.find(candidate => candidate.building.id === buildingId);

    return isNil(scene) ? point : clampPointToMultiPolygon(scene.polygons, point);
  }

  /**
   * Where a wall corner of the ACTIVE storey may land: on that storey's own
   * floor and no further. The ground storey's floor is the foundation slab;
   * an upper storey's floor is the slabs it was given, which is what lets it
   * overhang the storey below (R24) while still standing on something.
   *
   * An upper storey with no slabs yet constrains nothing — storeys drawn
   * before slabs existed keep deriving their outline from the walls, and
   * clamping them to an empty outline would pin every corner to one point.
   */
  clampWallPoint(buildingId: BuildingId, point: Vector2): Vector2 {
    const building = findBuildingIn(this.core.buildings, buildingId);

    if (isNil(building)) {
      return point;
    }

    if (storeysOf(building)[0]?.id === this.storeys.activeStoreyId) {
      return this.clampToFoundation(buildingId, point);
    }

    const slabs = this.storeyObjects.activeStoreySlabs;

    return slabs.length === 0 ? point : clampPointToMultiPolygon(slabsOutline(slabs), point);
  }

  /** The walls of the storey being edited — where junctions live. */
  private get activeStoreyWalls(): readonly Wall[] {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return [];
    }

    const building = findBuildingIn(this.core.buildings, session.buildingId);
    const storeyId =
      this.storeys.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);

    return isNil(building) || isNil(storeyId)
      ? []
      : (storeysOf(building).find(storey => storey.id === storeyId)?.walls ?? []);
  }

  /** The numbered edges of the selected junction, in badge order. */
  get selectedJunctionEdges(): readonly JunctionEdge[] {
    return isNil(this.selectedJunction)
      ? []
      : junctionEdgesAt(this.activeStoreyWalls, this.selectedJunction);
  }

  selectJunction(position: Vector2 | undefined): void {
    this.selectedJunction = position;
  }

  /**
   * Re-derives the crossing vertices after a finished wall edit — the
   * invariant that every стык is a junction. Belongs to the edit's own
   * history step, so it never announces one.
   */
  normalizeCrossings(buildingId: BuildingId): void {
    this.core.buildings = normalizeBuildingWallCrossingsIn(this.core.buildings, buildingId);
  }

  /** Moves the whole junction: every coincident vertex of the storey follows. */
  moveWallJunction(buildingId: BuildingId, from: Vector2, to: Vector2): void {
    const storeyId = this.storeys.activeStoreyId;

    if (isNil(storeyId)) {
      return;
    }

    this.core.buildings = moveWallJunctionIn(
      this.core.buildings,
      buildingId,
      storeyId,
      from,
      this.clampWallPoint(buildingId, to)
    );
  }

  /** The junction UI's «цифра N»: removes that edge, dealing what it hosted. */
  removeWallEdge(buildingId: BuildingId, wallId: WallId, segmentIndex: number): void {
    this.core.pushHistory();
    this.core.buildings = removeWallEdgeIn(this.core.buildings, buildingId, wallId, segmentIndex);
    this.normalizeCrossings(buildingId);
  }

  /**
   * The junction UI's «S»: cuts the wall standing at the selected junction in
   * two right there — the selected wall when it runs through, else whichever
   * does. Both halves keep the junction, so the стык survives the cut.
   */
  splitWallAtJunction(buildingId: BuildingId): void {
    const junction = this.selectedJunction;

    if (isNil(junction)) {
      return;
    }

    const refs = junctionVerticesAt(this.activeStoreyWalls, junction);
    const target = refs.find(ref => ref.wallId === this.selectedWall?.id) ?? refs[0];

    if (isNil(target)) {
      return;
    }

    this.core.pushHistory();
    this.cutWallAtPoint(buildingId, target.wallId, target.pointIndex);
  }

  /** Replaces one drawn point; the caller announces the history step it belongs to. */
  moveWallPoint(buildingId: BuildingId, wallId: WallId, pointIndex: number, point: Vector2): void {
    this.core.buildings = moveWallPointIn(
      this.core.buildings,
      buildingId,
      wallId,
      pointIndex,
      point
    );
  }

  /** Plants a corner in a segment; the caller announces the history step. */
  insertWallPoint(
    buildingId: BuildingId,
    wallId: WallId,
    segmentIndex: number,
    point: Vector2
  ): void {
    this.core.buildings = insertWallPointIn(
      this.core.buildings,
      buildingId,
      wallId,
      segmentIndex,
      point
    );
  }

  /** Refuses silently at the wall's floor; the caller announced the step. */
  removeWallPoint(buildingId: BuildingId, wallId: WallId, pointIndex: number): void {
    this.core.buildings = removeWallPointIn(this.core.buildings, buildingId, wallId, pointIndex);
  }

  /** Closes the wall into a ring — the endpoint gesture and the panel button alike. */
  closeWallRing(buildingId: BuildingId, wallId: WallId): void {
    this.core.pushHistory();
    this.core.buildings = closeWallRingIn(this.core.buildings, buildingId, wallId);
  }

  /** Cuts the wall at a corner: a ring opens there, an open wall splits in two. */
  cutWallAtPoint(buildingId: BuildingId, wallId: WallId, pointIndex: number): void {
    this.core.buildings = cutWallAtPointIn(this.core.buildings, buildingId, wallId, pointIndex);
  }

  /** Replaces a wall whole — the restore half of an interrupted point drag. */
  restoreWall(buildingId: BuildingId, wall: Wall): void {
    this.core.buildings = updateWallIn(this.core.buildings, buildingId, wall.id, wall);
  }

  removeWall(buildingId: BuildingId, wallId: WallId): void {
    this.core.pushHistory();
    this.core.buildings = removeWallFrom(this.core.buildings, buildingId, wallId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'wall' && selection.wallId === wallId) {
      this.core.selections = NO_SELECTIONS;
    }
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
