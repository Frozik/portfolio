import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { dropRepeatedPoints } from '../domain/geometry/dedupe-polyline';
import { magnetizeBesideRoutes, ROUTE_MAGNET_RADIUS_PX } from '../domain/geometry/route-magnetism';
import type { BuildingId } from '../domain/model/building';
import { storeysOf } from '../domain/model/building';
import { findBuilding } from '../domain/model/building-edits';
import type { CableTypeId } from '../domain/model/cables';
import { setGroupCableType as setGroupCableTypeIn } from '../domain/model/device-edits';
import type { CircuitGroupId } from '../domain/model/electrical';
import type { InstallationPresetId } from '../domain/model/installation';
import {
  DEFAULT_INSTALLATION_PRESET,
  installationPreset,
  installationWidthMeters,
} from '../domain/model/installation';
import {
  addStoreyObject,
  findStoreyObject,
  updateStoreyObject,
} from '../domain/model/storey-edits';
import { WIRING_ROUTE_OBJECTS } from '../domain/model/storey-objects';
import { wiringRoutesOf } from '../domain/model/storeys';
import type { WiringLevel, WiringRoute, WiringRouteId } from '../domain/model/wiring-routes';
import {
  createWiringRoute,
  insertRoutePoint,
  MIN_WIRING_ROUTE_POINTS,
  moveRoutePoint,
  removeRoutePoint,
  setRouteSegmentInstallation,
} from '../domain/model/wiring-routes';
import type { KeyPointSnap } from '../domain/view/object-snapping';
import { NO_SNAP_STEP, snapPoint } from '../domain/view/snapping';
import type { PlanEditorCore } from './editor-core';
import { MIN_ROUTE_LINE_WIDTH_PX } from './render/plan-draw/draw-electrical';
import type { StoreysModel } from './StoreysModel';

const GROUP_CABLE_HISTORY_GROUP = 'group:cable';

/**
 * The hand-drawn cable routes of the open building (`wiring.md` §3.3): the
 * one being clicked out, the committed ones on the active storey, and the
 * cable each группа is wired in. The runs themselves stay derived.
 */
export class WiringModel {
  private readonly core: PlanEditorCore;
  private readonly storeys: StoreysModel;

  constructor(core: PlanEditorCore, storeys: StoreysModel) {
    this.core = core;
    this.storeys = storeys;

    makeAutoObservable<WiringModel, 'core' | 'storeys'>(
      this,
      { core: false, storeys: false },
      { autoBind: true }
    );
  }

  get draftRoutePoints(): readonly Vector2[] {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.draftRoutePoints
      : NO_POINTS;
  }

  /** The routes already laid on the active storey. */
  private get activeStoreyRoutes(): readonly WiringRoute[] {
    const session = this.core.editorSession;
    const building =
      session?.kind === 'building'
        ? findBuilding(this.core.buildings, session.buildingId)
        : undefined;
    const storey = isNil(building)
      ? undefined
      : storeysOf(building).find(candidate => candidate.id === this.storeys.activeStoreyId);

    return isNil(storey) ? NO_ROUTES : wiringRoutesOf(storey);
  }

  /**
   * A point laid beside an existing route lands touching it (`wiring.md` §9):
   * the magnet outranks the grid the way OSNAP outranks it, and Alt holds it
   * off with every other snap.
   */
  besideRoutes(point: Vector2, widthMeters: number, except?: WiringRouteId): Vector2 | undefined {
    if (this.core.view.cursorModifiers.isAltPressed) {
      return undefined;
    }

    const { pixelsPerMeter } = this.core.view.viewport;

    return magnetizeBesideRoutes({
      routes: this.activeStoreyRoutes.filter(route => route.id !== except),
      point,
      widthMeters,
      reachMeters: ROUTE_MAGNET_RADIUS_PX / pixelsPerMeter,
      // As wide as the stroke the plan draws a conduit with, so the laid run
      // sits beside its neighbour on screen, edge to edge, rather than under it.
      minGapMeters: MIN_ROUTE_LINE_WIDTH_PX / pixelsPerMeter,
      widthOf: (route, segmentIndex) =>
        installationWidthMeters(installationPreset(route.segments[segmentIndex].installation)),
    });
  }

  /**
   * Where the next bend would land: beside a neighbouring route if one is in
   * reach, else on the grid unless Alt holds the snap off. The rubber band and
   * the click both read this, so what is on screen is what gets laid.
   */
  get draftRouteCursor(): Vector2 | undefined {
    const cursor = this.core.view.cursorPlanPoint;

    if (isNil(cursor)) {
      return undefined;
    }

    const beside = this.besideRoutes(
      cursor,
      installationWidthMeters(installationPreset(this.armedInstallation))
    );

    if (!isNil(beside)) {
      return beside;
    }

    const { isSnapEnabled, gridStepMeters } = this.core.settings;

    return snapPoint(
      cursor,
      isSnapEnabled && !this.core.view.cursorModifiers.isAltPressed ? gridStepMeters : NO_SNAP_STEP
    );
  }

  /**
   * The catch the magnet has made with the route tool in hand — before the
   * first click as much as after it — so the plan can show where the next
   * bend will land beside its neighbour before it is laid.
   */
  get draftRouteSnap(): KeyPointSnap | undefined {
    const cursor = this.core.view.cursorPlanPoint;

    if (this.core.activeTool !== 'building:route' || isNil(cursor)) {
      return undefined;
    }

    const beside = this.besideRoutes(
      cursor,
      installationWidthMeters(installationPreset(this.armedInstallation))
    );

    return isNil(beside)
      ? undefined
      : {
          ownPoint: cursor,
          targetPoint: beside,
          delta: { x: beside.x - cursor.x, y: beside.y - cursor.y },
        };
  }

  /** The draft with the rubber band to the cursor, for the plan to draw; nothing before the first click. */
  get draftRoutePreview(): readonly Vector2[] {
    const cursor = this.draftRouteCursor;
    const points = this.draftRoutePoints;

    return points.length === 0 || isNil(cursor) ? points : [...points, cursor];
  }

  get armedInstallation(): InstallationPresetId {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedInstallation
      : DEFAULT_INSTALLATION_PRESET;
  }

  setArmedInstallation(installation: InstallationPresetId): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedInstallation(installation);
    }
  }

  /** The route the selection names, when it still exists. */
  get selectedRoute(): WiringRoute | undefined {
    const { selection } = this.core;

    return selection?.kind === 'wiringRoute'
      ? findStoreyObject(
          this.core.buildings,
          selection.buildingId,
          WIRING_ROUTE_OBJECTS,
          selection.routeId
        )
      : undefined;
  }

  appendDraftRoutePoint(point: Vector2): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.appendDraftRoutePoint(point);
    }
  }

  dropLastDraftRoutePoint(): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.dropLastDraftRoutePoint();
    }
  }

  cancelDraftRoute(): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.clearDraftRoute();
    }
  }

  /**
   * Lays the clicked-out polyline as a route in the armed method — one step
   * to undo, selected, and with the select tool handed back (R32): the
   * route just laid is the one to be corrected, so its squares and rings
   * are already under the pointer.
   */
  commitDraftRoute(): void {
    const session = this.core.editorSession;
    const storeyId = this.storeys.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    const points = dropRepeatedPoints(session.draftRoutePoints);

    session.clearDraftRoute();

    if (points.length < MIN_WIRING_ROUTE_POINTS) {
      return;
    }

    const route = createWiringRoute({ points, installation: session.armedInstallation });

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      WIRING_ROUTE_OBJECTS,
      route
    );
    this.core.setSelection({
      kind: 'wiringRoute',
      buildingId: session.buildingId,
      routeId: route.id,
    });
    this.core.setActiveTool('select');
  }

  /** Writes a route back whole; a drag announced its own history step when it began. */
  updateRoute(buildingId: BuildingId, route: WiringRoute): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      WIRING_ROUTE_OBJECTS,
      route.id,
      route
    );
  }

  /** Follows a dragged bend; the gesture announced its history step at the grab. */
  moveRoutePoint(
    buildingId: BuildingId,
    routeId: WiringRouteId,
    pointIndex: number,
    position: Vector2
  ): void {
    const route = findStoreyObject(this.core.buildings, buildingId, WIRING_ROUTE_OBJECTS, routeId);

    if (!isNil(route)) {
      this.updateRoute(buildingId, moveRoutePoint(route, pointIndex, position));
    }
  }

  /** Plants a bend inside a stretch — the midpoint ring's grab, announced by the gesture. */
  insertRoutePoint(
    buildingId: BuildingId,
    routeId: WiringRouteId,
    segmentIndex: number,
    position: Vector2
  ): void {
    const route = findStoreyObject(this.core.buildings, buildingId, WIRING_ROUTE_OBJECTS, routeId);

    if (!isNil(route)) {
      this.updateRoute(buildingId, insertRoutePoint(route, segmentIndex, position));
    }
  }

  /** Takes a bend out — the double click on its square; one step to undo. */
  removeRoutePoint(buildingId: BuildingId, routeId: WiringRouteId, pointIndex: number): void {
    const route = findStoreyObject(this.core.buildings, buildingId, WIRING_ROUTE_OBJECTS, routeId);

    if (isNil(route) || route.points.length <= MIN_WIRING_ROUTE_POINTS) {
      return;
    }

    this.core.pushHistory();
    this.updateRoute(buildingId, removeRoutePoint(route, pointIndex));
  }

  setSegmentInstallation(
    buildingId: BuildingId,
    routeId: WiringRouteId,
    segmentIndex: number,
    installation: InstallationPresetId
  ): void {
    const route = findStoreyObject(this.core.buildings, buildingId, WIRING_ROUTE_OBJECTS, routeId);

    if (isNil(route)) {
      return;
    }

    this.core.pushHistory();
    this.updateRoute(buildingId, setRouteSegmentInstallation(route, segmentIndex, installation));
  }

  setRouteLevel(buildingId: BuildingId, routeId: WiringRouteId, level: WiringLevel): void {
    const route = findStoreyObject(this.core.buildings, buildingId, WIRING_ROUTE_OBJECTS, routeId);

    if (isNil(route) || route.level === level) {
      return;
    }

    this.core.pushHistory();
    this.updateRoute(buildingId, { ...route, level });
  }

  /** Overrides the cable of a группа; nothing restores the section its consumers imply. */
  setGroupCableType(
    buildingId: BuildingId,
    groupId: CircuitGroupId,
    cableTypeId: CableTypeId | undefined
  ): void {
    this.core.pushHistory(`${GROUP_CABLE_HISTORY_GROUP}:${groupId}`);
    this.core.buildings = setGroupCableTypeIn(
      this.core.buildings,
      buildingId,
      groupId,
      cableTypeId
    );
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}

const NO_POINTS: readonly Vector2[] = [];
const NO_ROUTES: readonly WiringRoute[] = [];
