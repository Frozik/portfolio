import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { dropRepeatedPoints } from '../domain/geometry/dedupe-polyline';
import type { SegmentReadout } from '../domain/geometry/draw-constraints';
import {
  appendTypedLengthKey as appendTypedLengthKeyText,
  applyTypedLength,
  constrainToAngleStep,
  parseTypedLength,
  segmentReadout,
} from '../domain/geometry/draw-constraints';
import { clampPointToMultiPolygon } from '../domain/geometry/polygon-booleans';
import { slabsOutline } from '../domain/geometry/slab-geometry';
import { findBuilding as findBuildingIn } from '../domain/model/building-edits';
import type { Opening, OpeningId, OpeningPreset } from '../domain/model/openings';
import { createOpening, DEFAULT_OPENING_PRESET } from '../domain/model/openings';
import type { Selection } from '../domain/model/selection';
import type { BuildingId } from '../domain/model/site-plan';
import { storeysOf } from '../domain/model/site-plan';
import {
  addOpening as addOpeningIn,
  addWall as addWallIn,
  closeWallRing as closeWallRingIn,
  cutWallAtPoint as cutWallAtPointIn,
  findOpening as findOpeningIn,
  findWall as findWallIn,
  insertWallPoint as insertWallPointIn,
  moveWallPoint as moveWallPointIn,
  removeOpening as removeOpeningFrom,
  removeWall as removeWallFrom,
  removeWallPoint as removeWallPointIn,
  updateOpening as updateOpeningIn,
  updateWall as updateWallIn,
} from '../domain/model/wall-edits';
import type { Wall, WallId } from '../domain/model/walls';
import { createWall, MIN_CLOSED_WALL_POINTS, MIN_WALL_POINTS } from '../domain/model/walls';
import type { Meters } from '../domain/units';
import {
  findNearestSnapPoint,
  KEY_POINT_SNAP_RADIUS_PX,
  wallSnapPoints,
} from '../domain/view/object-snapping';
import { NO_SNAP_STEP, snapPoint } from '../domain/view/snapping';
import type { BuildingModel } from './BuildingModel';
import type { PlanEditorCore } from './editor-core';
import type { SceneModel } from './SceneModel';
import type { StoreyObjectsEditorModel } from './StoreyObjectsEditorModel';

/**
 * The walls of the open building and the openings cut into them: the polyline
 * being clicked out (with its typed-length keyboard path), the committed
 * walls' point surgery, and the doors and windows on their hosts. Owns the
 * typed-length input; the walls themselves live in the document.
 */
const WALL_HISTORY_GROUP = 'wall';
const OPENING_HISTORY_GROUP = 'opening';
/**
 * A drawn ring closes when its ends land within a hand's tremble of each
 * other — far looser than the geometric seam epsilon, which is for floats.
 */
const DRAWN_RING_SEAM_EPSILON_METERS = 0.05;

const NO_SELECTIONS: readonly Selection[] = [];

export class WallEditorModel {
  /** A length typed while a wall segment is being aimed (the CAD VCB). */
  typedLengthText: string | undefined = undefined;
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;
  private readonly building: BuildingModel;
  private readonly storeyObjects: StoreyObjectsEditorModel;

  constructor(
    core: PlanEditorCore,
    scene: SceneModel,
    building: BuildingModel,
    storeyObjects: StoreyObjectsEditorModel
  ) {
    this.core = core;
    this.scene = scene;
    this.building = building;
    this.storeyObjects = storeyObjects;

    makeAutoObservable<WallEditorModel, 'core' | 'scene' | 'building' | 'storeyObjects'>(
      this,
      { core: false, scene: false, building: false, storeyObjects: false },
      { autoBind: true }
    );
  }

  /** The metres the typed text stands for, or nothing while it is unusable. */
  get typedLengthMeters(): Meters | undefined {
    return parseTypedLength(this.typedLengthText);
  }

  /** Types into the VCB: the next committed segment takes this exact length. */
  setTypedLengthText(typedLengthText: string | undefined): void {
    this.typedLengthText = typedLengthText;
  }

  appendTypedLengthKey(key: string): void {
    this.typedLengthText = appendTypedLengthKeyText(this.typedLengthText, key);
  }

  dropLastDraftWallPoint(): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.dropLastDraftWallPoint();
    }
  }

  /** The wall the selection names, when it still exists. */
  get selectedWall(): Wall | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'wall'
      ? undefined
      : findWallIn(this.core.buildings, selection.buildingId, selection.wallId);
  }

  /** The polyline of the wall being clicked out inside the building editor. */
  get draftWallPoints(): readonly Vector2[] {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.draftWallPoints
      : [];
  }

  /**
   * Where the wall being drawn would reach if it were committed now: the
   * cursor, grid-snapped, angle-locked while Shift is down and pushed to the
   * typed length if one was typed. Both the rubber band and the click itself
   * read this, so what is on screen is what gets built.
   */
  get draftWallCursor(): Vector2 | undefined {
    const points = this.draftWallPoints;
    const cursor = this.core.cursorPlanPoint;

    if (points.length === 0 || isNil(cursor)) {
      return undefined;
    }

    const last = points[points.length - 1];

    // Object snap wins over both the grid and the angle lock, the way OSNAP
    // outranks ORTHO in every CAD: catching the corner of an existing wall is
    // the most specific intent a cursor can express. Alt suspends it with
    // every other snap.
    if (!this.core.cursorModifiers.isAltPressed) {
      const caught = findNearestSnapPoint(
        this.wallSnapCandidates,
        cursor,
        KEY_POINT_SNAP_RADIUS_PX / this.core.viewport.pixelsPerMeter
      );

      if (!isNil(caught)) {
        return caught;
      }
    }

    const { isSnapEnabled, gridStepMeters } = this.core.settings;
    const snapped = snapPoint(
      cursor,
      isSnapEnabled && !this.core.cursorModifiers.isAltPressed ? gridStepMeters : NO_SNAP_STEP
    );
    const locked = this.core.cursorModifiers.isShiftPressed
      ? constrainToAngleStep(last, snapped)
      : snapped;

    return isNil(this.typedLengthMeters)
      ? locked
      : applyTypedLength(last, locked, this.typedLengthMeters);
  }

  /** Corners and midpoints of the walls already standing on the active storey. */
  get wallSnapCandidates(): readonly Vector2[] {
    const scene = this.building.editedStoreyScene;

    return isNil(scene) ? [] : wallSnapPoints(scene.storey.walls);
  }

  /** Length and angle of the segment in flight — the readout by the cursor. */
  get draftWallReadout(): SegmentReadout | undefined {
    const points = this.draftWallPoints;
    const cursor = this.draftWallCursor;

    if (points.length === 0 || isNil(cursor)) {
      return undefined;
    }

    return segmentReadout(points[points.length - 1], cursor);
  }

  appendDraftWallPoint(point: Vector2): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.appendDraftWallPoint(point);
    }
  }

  cancelDraftWall(): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.clearDraftWall();
    }
  }

  /**
   * Turns the clicked-out polyline into a wall of the default construction —
   * one step to undo — and hands it over selected, its numbers one typed
   * change away in the panel.
   */
  commitDraftWall(): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    const drawnPoints = dropRepeatedPoints(session.draftWallPoints);

    session.clearDraftWall();

    if (drawnPoints.length < MIN_WALL_POINTS) {
      return;
    }

    const building = findBuildingIn(this.core.buildings, session.buildingId);
    const storeyId =
      this.building.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);

    if (isNil(storeyId)) {
      return;
    }

    // A line clicked back onto its own start was drawn as a contour: the
    // repeated point collapses into the seam and the wall closes right away.
    const [firstPoint] = drawnPoints;
    const lastPoint = drawnPoints[drawnPoints.length - 1];
    const isDrawnClosed =
      drawnPoints.length > MIN_CLOSED_WALL_POINTS &&
      Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) <=
        DRAWN_RING_SEAM_EPSILON_METERS;
    const points = isDrawnClosed ? drawnPoints.slice(0, -1) : drawnPoints;

    const wall = isDrawnClosed
      ? { ...createWall({ points }), isClosed: true }
      : createWall({ points });

    this.core.pushHistory();
    this.core.buildings = addWallIn(this.core.buildings, session.buildingId, storeyId, wall);
    this.core.setSelection({ kind: 'wall', buildingId: session.buildingId, wallId: wall.id });
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

    if (storeysOf(building)[0]?.id === this.building.activeStoreyId) {
      return this.clampToFoundation(buildingId, point);
    }

    const slabs = this.storeyObjects.activeStoreySlabs;

    return slabs.length === 0 ? point : clampPointToMultiPolygon(slabsOutline(slabs), point);
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

  /** The opening the selection names, when it still exists. */
  get selectedOpening(): Opening | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'opening'
      ? undefined
      : findOpeningIn(this.core.buildings, selection.buildingId, selection.openingId);
  }

  /** What the opening tool places next; door until the editor arms another. */
  get armedOpeningPreset(): OpeningPreset {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedOpeningPreset
      : DEFAULT_OPENING_PRESET;
  }

  setArmedOpeningPreset(preset: OpeningPreset): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedOpeningPreset(preset);
    }
  }

  /**
   * Hangs the armed preset's opening onto the wall at that offset — one step
   * to undo — and hands it over selected.
   */
  addOpeningAt(buildingId: BuildingId, wallId: WallId, offsetMeters: Meters): void {
    const opening = createOpening({ wallId, preset: this.armedOpeningPreset, offsetMeters });

    this.core.pushHistory();
    this.core.buildings = addOpeningIn(this.core.buildings, buildingId, opening);
    this.core.setSelection({ kind: 'opening', buildingId, openingId: opening.id });
  }

  /**
   * Edits an opening field by field. Typed numbers group per opening, so a
   * burst of keystrokes stays one step to undo.
   */
  updateOpeningProperties(
    buildingId: BuildingId,
    openingId: OpeningId,
    changes: Partial<Omit<Opening, 'id' | 'wallId' | 'kind'>>
  ): void {
    this.core.pushHistory(`${OPENING_HISTORY_GROUP}:${openingId}`);
    this.core.buildings = updateOpeningIn(this.core.buildings, buildingId, openingId, changes);
  }

  /** Slides the opening along its wall; the caller announces the history step. */
  moveOpening(buildingId: BuildingId, openingId: OpeningId, offsetMeters: Meters): void {
    this.core.buildings = updateOpeningIn(this.core.buildings, buildingId, openingId, {
      offsetMeters,
    });
  }

  removeOpening(buildingId: BuildingId, openingId: OpeningId): void {
    this.core.pushHistory();
    this.core.buildings = removeOpeningFrom(this.core.buildings, buildingId, openingId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'opening' && selection.openingId === openingId) {
      this.core.selections = NO_SELECTIONS;
    }
  }
}
