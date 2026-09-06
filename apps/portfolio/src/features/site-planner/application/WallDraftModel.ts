import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { baseSnapPoints, slideOntoCircleRim } from '../domain/geometry/base-snap-points';
import { dropRepeatedPoints } from '../domain/geometry/dedupe-polyline';
import type { SegmentReadout } from '../domain/geometry/draw-constraints';
import {
  appendTypedLengthKey as appendTypedLengthKeyText,
  applyTypedLength,
  constrainToAngleStep,
  parseTypedLength,
  segmentReadout,
} from '../domain/geometry/draw-constraints';
import { evaluateComposition } from '../domain/geometry/evaluate-composition';
import { slabsOutline } from '../domain/geometry/slab-geometry';
import { storeysOf } from '../domain/model/building';
import { findBuilding as findBuildingIn } from '../domain/model/building-edits';
import type { Shape } from '../domain/model/shapes';
import { flattenShapes } from '../domain/model/shapes';
import { addWall as addWallIn } from '../domain/model/wall-edits';
import { normalizeBuildingWallCrossings as normalizeBuildingWallCrossingsIn } from '../domain/model/wall-topology';
import type { Wall } from '../domain/model/walls';
import {
  createWall,
  isWallClosed,
  MIN_CLOSED_WALL_POINTS,
  MIN_WALL_POINTS,
} from '../domain/model/walls';
import type { Meters } from '../domain/units';
import {
  findNearestSnapPoint,
  KEY_POINT_SNAP_RADIUS_PX,
  wallSnapPoints,
} from '../domain/view/object-snapping';
import { NO_SNAP_STEP, snapPoint } from '../domain/view/snapping';
import type { PlanEditorCore } from './editor-core';
import type { StoreyObjectsEditorModel } from './StoreyObjectsEditorModel';
import type { StoreysModel } from './StoreysModel';

/**
 * A drawn ring closes when its ends land within a hand's tremble of each
 * other — far looser than the geometric seam epsilon, which is for floats.
 */
const DRAWN_RING_SEAM_EPSILON_METERS = 0.05;

function hasWallOnRing(walls: readonly Wall[], ring: readonly Vector2[]): boolean {
  return walls.some(
    wall =>
      isWallClosed(wall) &&
      wall.points.length === ring.length &&
      wall.points.every((point, index) => point.x === ring[index].x && point.y === ring[index].y)
  );
}

/**
 * The wall being clicked out inside the building editor: the polyline in
 * flight, its snaps and rubber band, the typed-length keyboard path, and the
 * commit that turns it into a wall of the default construction.
 */
export class WallDraftModel {
  /** A length typed while a wall segment is being aimed (the CAD VCB). */
  typedLengthText: string | undefined = undefined;
  private readonly core: PlanEditorCore;
  private readonly storeys: StoreysModel;
  private readonly storeyObjects: StoreyObjectsEditorModel;

  constructor(
    core: PlanEditorCore,
    storeys: StoreysModel,
    storeyObjects: StoreyObjectsEditorModel
  ) {
    this.core = core;
    this.storeys = storeys;
    this.storeyObjects = storeyObjects;

    makeAutoObservable<WallDraftModel, 'core' | 'storeys' | 'storeyObjects'>(
      this,
      { core: false, storeys: false, storeyObjects: false },
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
    const cursor = this.core.view.cursorPlanPoint;

    if (points.length === 0 || isNil(cursor)) {
      return undefined;
    }

    const last = points[points.length - 1];

    // Object snap wins over both the grid and the angle lock, the way OSNAP
    // outranks ORTHO in every CAD: catching the corner of an existing wall is
    // the most specific intent a cursor can express. Alt suspends it with
    // every other snap.
    if (!this.core.view.cursorModifiers.isAltPressed) {
      const caught = findNearestSnapPoint(
        this.wallSnapCandidates,
        cursor,
        KEY_POINT_SNAP_RADIUS_PX / this.core.view.viewport.pixelsPerMeter
      );

      if (!isNil(caught)) {
        return caught;
      }
    }

    // The rim of a round base is where its walls live, and no grid point lies
    // on it: within reach the cursor rides the TRUE circle instead. Shift
    // (angle lock) and a typed length state a direction of their own, so
    // either one outranks the rim; Alt suspends it with every other snap.
    if (
      !this.core.view.cursorModifiers.isAltPressed &&
      !this.core.view.cursorModifiers.isShiftPressed &&
      isNil(this.typedLengthMeters)
    ) {
      const onRim = slideOntoCircleRim(
        this.baseShapes,
        cursor,
        KEY_POINT_SNAP_RADIUS_PX / this.core.view.viewport.pixelsPerMeter
      );

      if (!isNil(onRim)) {
        return onRim;
      }
    }

    const { isSnapEnabled, gridStepMeters } = this.core.settings;
    const snapped = snapPoint(
      cursor,
      isSnapEnabled && !this.core.view.cursorModifiers.isAltPressed ? gridStepMeters : NO_SNAP_STEP
    );
    const locked = this.core.view.cursorModifiers.isShiftPressed
      ? constrainToAngleStep(last, snapped)
      : snapped;

    return isNil(this.typedLengthMeters)
      ? locked
      : applyTypedLength(last, locked, this.typedLengthMeters);
  }

  /** Corners and midpoints of the walls already standing on the active storey. */
  get wallSnapCandidates(): readonly Vector2[] {
    const scene = this.storeys.editedStoreyScene;

    return isNil(scene)
      ? []
      : [...wallSnapPoints(scene.storey.walls), ...baseSnapPoints(this.baseShapes)];
  }

  /**
   * The parametric shapes the active storey stands on: the footprint's own
   * leaves on the ground floor, the slabs above it. These carry the TRUE
   * geometry — a circle here is a circle, not its polygonized facets — which
   * is what the base snaps and the rim slide are read from.
   */
  get baseShapes(): readonly Shape[] {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return [];
    }

    const building = findBuildingIn(this.core.buildings, session.buildingId);

    if (isNil(building)) {
      return [];
    }

    return storeysOf(building)[0]?.id === this.storeys.activeStoreyId
      ? flattenShapes(building.composition)
      : this.storeyObjects.activeStoreySlabs;
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
   * Where the FIRST click of the wall tool lands: the same object and rim
   * snaps the rubber band uses, minus the angle lock and typed length — with
   * no previous point there is no direction to hold yet.
   */
  firstWallPointAt(planPoint: Vector2): Vector2 {
    const withinMeters = KEY_POINT_SNAP_RADIUS_PX / this.core.view.viewport.pixelsPerMeter;

    if (!this.core.view.cursorModifiers.isAltPressed) {
      const caught = findNearestSnapPoint(this.wallSnapCandidates, planPoint, withinMeters);

      if (!isNil(caught)) {
        return caught;
      }

      const onRim = slideOntoCircleRim(this.baseShapes, planPoint, withinMeters);

      if (!isNil(onRim)) {
        return onRim;
      }
    }

    const { isSnapEnabled, gridStepMeters } = this.core.settings;

    return snapPoint(
      planPoint,
      isSnapEnabled && !this.core.view.cursorModifiers.isAltPressed ? gridStepMeters : NO_SNAP_STEP
    );
  }

  /**
   * One click instead of a facet-by-facet trace: a closed wall ring along
   * every outer ring of the storey's base — the footprint on the ground
   * floor, the slabs above. A ring the storey already carries wall-for-wall
   * is skipped, so the button cannot stack a second wall on the first.
   */
  traceBaseOutlineWalls(): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    const building = findBuildingIn(this.core.buildings, session.buildingId);
    const storeyId = this.storeys.activeStoreyId;

    if (isNil(building) || isNil(storeyId)) {
      return;
    }

    const isGround = storeysOf(building)[0]?.id === storeyId;
    const polygons = isGround
      ? evaluateComposition(building.composition)
      : slabsOutline(this.storeyObjects.activeStoreySlabs);
    const storey = storeysOf(building).find(candidate => candidate.id === storeyId);
    const rings = polygons
      .map(polygon => dropRepeatedPoints(polygon.outer))
      .filter(ring => ring.length >= MIN_CLOSED_WALL_POINTS)
      .filter(ring => !hasWallOnRing(storey?.walls ?? [], ring));

    if (rings.length === 0) {
      return;
    }

    this.core.pushHistory();

    let firstWall: Wall | undefined;

    for (const ring of rings) {
      const wall: Wall = { ...createWall({ points: ring }), isClosed: true };

      firstWall = firstWall ?? wall;
      this.core.buildings = addWallIn(this.core.buildings, session.buildingId, storeyId, wall);
    }

    if (!isNil(firstWall)) {
      this.core.buildings = normalizeBuildingWallCrossingsIn(
        this.core.buildings,
        session.buildingId
      );
      this.core.setSelection({
        kind: 'wall',
        buildingId: session.buildingId,
        wallId: firstWall.id,
      });
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
      this.storeys.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);

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
    this.core.buildings = normalizeBuildingWallCrossingsIn(this.core.buildings, session.buildingId);
    this.core.setSelection({ kind: 'wall', buildingId: session.buildingId, wallId: wall.id });
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
