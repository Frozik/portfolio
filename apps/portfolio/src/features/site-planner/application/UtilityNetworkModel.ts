import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';
import { dropRepeatedPoints } from '../domain/geometry/dedupe-polyline';
import {
  addUtilityEntry as addUtilityEntryIn,
  findBuilding as findBuildingIn,
  removeUtilityEntry as removeUtilityEntryFrom,
  updateUtilityEntry as updateUtilityEntryIn,
} from '../domain/model/building-edits';
import type { UtilityEntry, UtilityEntryId, UtilitySystem } from '../domain/model/foundation';
import {
  canEnterThroughFloor,
  createUtilityEntry,
  ENTRY_SPACING_METERS,
} from '../domain/model/foundation';
import {
  addUtilityRoute as addUtilityRouteIn,
  insertUtilityRoutePoint as insertUtilityRoutePointIn,
  moveUtilityRoutePoint as moveUtilityRoutePointIn,
  removeUtilityRoute as removeUtilityRouteFrom,
  removeUtilityRoutePoint as removeUtilityRoutePointIn,
  updateUtilityRoute as updateUtilityRouteIn,
} from '../domain/model/route-edits';
import type { RouteWarning } from '../domain/model/route-warnings';
import { collectRouteWarnings } from '../domain/model/route-warnings';
import type { UtilityRoute, UtilityRouteId } from '../domain/model/routing';
import {
  createUtilityRoute,
  DEFAULT_SEWER_DIAMETER_METERS,
  DEFAULT_TRENCH_SYSTEM,
  trenchDepthMeters,
} from '../domain/model/routing';
import type { Selection } from '../domain/model/selection';
import type { BuildingId } from '../domain/model/site-plan';
import { entriesOf, frostDepthOf } from '../domain/model/site-plan';
import { sampleHeight } from '../domain/terrain/heightfield';
import type { TrenchProfile } from '../domain/terrain/trench-profile';
import { buildTrenchProfile } from '../domain/terrain/trench-profile';
import type { Meters } from '../domain/units';
import type { PlanEditorCore } from './editor-core';
import type { UtilityRouteDraft } from './render/plan-draw/draw-utility-routes';
import type { SceneModel } from './SceneModel';
import type { TerrainModel } from './TerrainModel';

const NO_DRAFT_UTILITY_POINTS: readonly Vector2[] = [];
const NO_SELECTIONS: readonly Selection[] = [];
const MIN_ROUTE_POINT_COUNT = 2;
const ROUTE_HISTORY_GROUP = 'route';
const ENTRY_HISTORY_GROUP = 'entry';

/**
 * The utility networks as the editor works them: the trench being clicked out,
 * every committed run resolved against the terrain (burial, fall, volume), the
 * norm warnings, and the entries on the buildings' outlines. Owns the draft
 * state; the committed routes live in the document (the core).
 */
export class UtilityNetworkModel {
  /** The bends of the trench being clicked out, in click order. */
  draftUtilityPoints: readonly Vector2[] = NO_DRAFT_UTILITY_POINTS;
  /** The system the next committed trench will carry. */
  nextUtilitySystem: UtilitySystem = DEFAULT_TRENCH_SYSTEM;

  private readonly core: PlanEditorCore;
  private readonly terrain: TerrainModel;
  private readonly scene: SceneModel;

  constructor(core: PlanEditorCore, terrain: TerrainModel, scene: SceneModel) {
    this.core = core;
    this.terrain = terrain;
    this.scene = scene;

    makeAutoObservable<UtilityNetworkModel, 'core' | 'terrain' | 'scene'>(
      this,
      { core: false, terrain: false, scene: false, draftUtilityPoints: observableRef },
      { autoBind: true }
    );
  }

  /** The live preview of the trench being clicked out, cursor at its tail. */
  get draftUtilityPreview(): UtilityRouteDraft | undefined {
    const { draftUtilityPoints } = this;

    if (draftUtilityPoints.length === 0) {
      return undefined;
    }

    const cursor = this.core.cursorPlanPoint;

    return {
      system: this.nextUtilitySystem,
      points: isNil(cursor) ? draftUtilityPoints : [...draftUtilityPoints, cursor],
    };
  }

  /** The plot's frost depth — what every burial norm measures from (R17). */
  get frostDepthMeters(): Meters {
    return frostDepthOf(this.core.settings);
  }

  /**
   * Every trench resolved against the terrain: the norm burial for its system,
   * a sewer's gravity fall, the digging volume. One map for the panels, the
   * warning pass and the report alike.
   */
  get trenchProfiles(): ReadonlyMap<UtilityRouteId, TrenchProfile> {
    const { frostDepthMeters } = this;
    const { heightfield } = this.terrain;
    const profiles = new Map<UtilityRouteId, TrenchProfile>();

    for (const route of this.core.utilityRoutes) {
      const profile = buildTrenchProfile({
        points: route.points,
        system: route.system,
        burialDepthMeters: trenchDepthMeters(route.system, frostDepthMeters),
        diameterMeters: route.diameterMeters ?? DEFAULT_SEWER_DIAMETER_METERS,
        sampleElevation: position => sampleHeight(heightfield, position.x, position.y),
      });

      if (!isNil(profile)) {
        profiles.set(route.id, profile);
      }
    }

    return profiles;
  }

  /** The advisory findings of the norm pass, over every drawn trench. */
  get routeWarnings(): readonly RouteWarning[] {
    const { frostDepthMeters } = this;

    return collectRouteWarnings({
      routes: this.core.utilityRoutes,
      profiles: this.trenchProfiles,
      burialDepths: new Map(
        this.core.utilityRoutes.map(route => [
          route.id,
          trenchDepthMeters(route.system, frostDepthMeters),
        ])
      ),
      driveablePolygons: this.core.pathRibbonPolygons,
    });
  }

  /** What all the trenches displace together — the earthworks report's line. */
  get totalTrenchVolumeCubicMeters(): number {
    let volume = 0;

    for (const profile of this.trenchProfiles.values()) {
      volume += profile.volumeCubicMeters;
    }

    return volume;
  }

  get selectedUtilityRoute(): UtilityRoute | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'utilityRoute'
      ? undefined
      : this.core.utilityRoutes.find(route => route.id === selection.routeId);
  }

  /** The entry the selection names, with the building it sits on. */
  get selectedUtilityEntry():
    | { readonly buildingId: BuildingId; readonly entry: UtilityEntry }
    | undefined {
    const { selection } = this.core;

    if (isNil(selection) || selection.kind !== 'utilityEntry') {
      return undefined;
    }

    const building = findBuildingIn(this.core.buildings, selection.buildingId);
    const entry = isNil(building)
      ? undefined
      : entriesOf(building).find(candidate => candidate.id === selection.entryId);

    return isNil(entry) ? undefined : { buildingId: selection.buildingId, entry };
  }

  /**
   * Slides an entry along the outline WITHOUT announcing history — the drag
   * gesture announces once on pointer-down, exactly like moving a device.
   */
  moveUtilityEntry(
    buildingId: BuildingId,
    entryId: UtilityEntryId,
    outlineOffsetMeters: Meters
  ): void {
    this.core.buildings = updateUtilityEntryIn(this.core.buildings, buildingId, entryId, {
      outlineOffsetMeters,
      floorPosition: undefined,
    });
  }

  /**
   * Puts an entry through the slab at a point of the floor — the sleeve cast
   * into the foundation. Gas is refused: СП 62 keeps it on the facade, so its
   * badge can only slide the outline. History-less like the outline move.
   */
  moveEntryToFloor(buildingId: BuildingId, entryId: UtilityEntryId, position: Vector2): void {
    const building = findBuildingIn(this.core.buildings, buildingId);
    const entry = isNil(building)
      ? undefined
      : entriesOf(building).find(candidate => candidate.id === entryId);

    if (isNil(entry) || !canEnterThroughFloor(entry.system)) {
      return;
    }

    this.core.buildings = updateUtilityEntryIn(this.core.buildings, buildingId, entryId, {
      floorPosition: position,
    });
  }

  setNextUtilitySystem(system: UtilitySystem): void {
    this.nextUtilitySystem = system;
  }

  /** Adds a bend to the trench being clicked out; the first one starts it. */
  appendDraftUtilityPoint(point: Vector2): void {
    this.draftUtilityPoints = [...this.draftUtilityPoints, point];
  }

  /** Turns the polyline into a trench of the armed system, one step to undo. */
  commitDraftUtilityRoute(): void {
    const points = dropRepeatedPoints(this.draftUtilityPoints);

    this.draftUtilityPoints = NO_DRAFT_UTILITY_POINTS;

    if (points.length < MIN_ROUTE_POINT_COUNT) {
      return;
    }

    const route = createUtilityRoute({ system: this.nextUtilitySystem, points });

    this.core.pushHistory();
    this.core.utilityRoutes = addUtilityRouteIn(this.core.utilityRoutes, route);
    this.core.selections = [{ kind: 'utilityRoute', routeId: route.id }];
  }

  cancelDraftUtilityRoute(): void {
    this.draftUtilityPoints = NO_DRAFT_UTILITY_POINTS;
  }

  /** Replaces a trench whole — the restore half of an interrupted drag. */
  updateUtilityRoute(route: UtilityRoute): void {
    this.core.utilityRoutes = updateUtilityRouteIn(this.core.utilityRoutes, route);
  }

  moveUtilityRoutePoint(routeId: UtilityRouteId, pointIndex: number, point: Vector2): void {
    this.core.utilityRoutes = moveUtilityRoutePointIn(
      this.core.utilityRoutes,
      routeId,
      pointIndex,
      point
    );
  }

  insertUtilityRoutePoint(routeId: UtilityRouteId, segmentIndex: number, point: Vector2): void {
    this.core.utilityRoutes = insertUtilityRoutePointIn(
      this.core.utilityRoutes,
      routeId,
      segmentIndex,
      point
    );
  }

  /** Refuses silently below a segment's worth; the caller announced the step. */
  removeUtilityRoutePoint(routeId: UtilityRouteId, pointIndex: number): void {
    this.core.utilityRoutes = removeUtilityRoutePointIn(
      this.core.utilityRoutes,
      routeId,
      pointIndex
    );
  }

  /**
   * Re-labels a trench with another system. The bore follows the system the
   * way a tree's size follows its species: a sewer gains the standard pipe,
   * anything else stops carrying one.
   */
  setUtilityRouteSystem(routeId: UtilityRouteId, system: UtilitySystem): void {
    const route = this.core.utilityRoutes.find(candidate => candidate.id === routeId);

    if (isNil(route) || route.system === system) {
      return;
    }

    this.core.pushHistory();
    this.core.utilityRoutes = updateUtilityRouteIn(this.core.utilityRoutes, {
      ...route,
      system,
      diameterMeters: system === 'sewer' ? DEFAULT_SEWER_DIAMETER_METERS : undefined,
    });
  }

  setUtilityRouteDiameter(routeId: UtilityRouteId, diameterMeters: Meters): void {
    const route = this.core.utilityRoutes.find(candidate => candidate.id === routeId);

    if (isNil(route)) {
      return;
    }

    this.core.pushHistory(`${ROUTE_HISTORY_GROUP}:${routeId}`);
    this.core.utilityRoutes = updateUtilityRouteIn(this.core.utilityRoutes, {
      ...route,
      diameterMeters,
    });
  }

  removeUtilityRoute(routeId: UtilityRouteId): void {
    // The СЕТИ panel offers removal inside the trench editor too, and an
    // editor must not stay open on an object that no longer exists.
    if (
      this.core.editorMode.kind === 'edit' &&
      this.core.editorMode.target.kind === 'utilityRoute' &&
      this.core.editorMode.target.routeId === routeId
    ) {
      this.core.exitEditMode();
    }

    this.core.pushHistory();
    this.core.utilityRoutes = removeUtilityRouteFrom(this.core.utilityRoutes, routeId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'utilityRoute' && selection.routeId === routeId) {
      this.core.selections = NO_SELECTIONS;
    }
  }

  /**
   * Adds one system's entry with its norm defaults (`createUtilityEntry`),
   * landing it a step further along the outline than the last one.
   */
  addUtilityEntry(buildingId: BuildingId, system: UtilitySystem): void {
    const building = findBuildingIn(this.core.buildings, buildingId);

    if (isNil(building)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addUtilityEntryIn(
      this.core.buildings,
      buildingId,
      createUtilityEntry({
        system,
        outlineOffsetMeters: entriesOf(building).length * ENTRY_SPACING_METERS,
        frostDepthMeters: this.frostDepthMeters,
      })
    );
  }

  removeUtilityEntry(buildingId: BuildingId, entryId: UtilityEntryId): void {
    this.core.pushHistory();
    this.core.buildings = removeUtilityEntryFrom(this.core.buildings, buildingId, entryId);
  }

  updateUtilityEntry(
    buildingId: BuildingId,
    entryId: UtilityEntryId,
    changes: Partial<Omit<UtilityEntry, 'id' | 'system'>>
  ): void {
    this.core.pushHistory(`${ENTRY_HISTORY_GROUP}:${entryId}`);
    this.core.buildings = updateUtilityEntryIn(this.core.buildings, buildingId, entryId, changes);
  }

  /**
   * The nearest entry of one system within reach — what a trench click snaps
   * onto and a dragged bend lands on, so the site run and the indoor run
   * actually meet at the seam the entry is.
   */
  nearestEntryPoint(
    planPoint: Vector2,
    withinMeters: Meters,
    system: UtilitySystem
  ): Vector2 | undefined {
    let nearest: Vector2 | undefined;
    let nearestDistance = withinMeters;

    for (const scene of this.scene.buildingScenes) {
      for (const entry of scene.entryPoints) {
        if (entry.system !== system) {
          continue;
        }

        const distance = Math.hypot(entry.position.x - planPoint.x, entry.position.y - planPoint.y);

        if (distance <= nearestDistance) {
          nearest = entry.position;
          nearestDistance = distance;
        }
      }
    }

    return nearest;
  }
}
