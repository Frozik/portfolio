import { assertNever } from '@frozik/utils/assert/assertNever';
import { createHistory } from '@frozik/utils/history/createHistory';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isEqual, isNil } from 'lodash-es';
import type { IReactionDisposer } from 'mobx';
import { makeAutoObservable, observableRef, reaction, runInAction } from 'mobx';
import type { Temporal } from 'temporal-polyfill';
import {
  APRON_DEPTH_METERS,
  DEFAULT_PATH_WIDTH_METERS,
  DEFAULT_SITE_LENGTH_METERS,
  DEFAULT_SITE_WIDTH_METERS,
  PATH_DRAPE_OFFSET_METERS,
} from '../domain/constants';
import type { BoundingBox } from '../domain/geometry/bounding-box';
import { computeMultiPolygonBounds } from '../domain/geometry/bounding-box';
import {
  foundationVolumeCubicMeters,
  multiPolygonArea,
  pointOnOutline,
} from '../domain/geometry/building-outline';
import { evaluateComposition } from '../domain/geometry/evaluate-composition';
import { extrudeFootprint, extrudePrism } from '../domain/geometry/extrude-footprint';
import type { LitMesh, PathDrapeGeometry, RoofOverlayGeometry } from '../domain/geometry/lit-mesh';
import { mergeLitMeshes } from '../domain/geometry/lit-mesh';
import { buildPathRibbon, offsetPolygons } from '../domain/geometry/offset-polygon';
import type { PathRibbon } from '../domain/geometry/path-ribbon';
import { buildPathRibbons } from '../domain/geometry/path-ribbon';
import {
  clampPointToMultiPolygon,
  interiorPointOf,
  isPointInMultiPolygon,
  subtractPolygons,
} from '../domain/geometry/polygon-booleans';
import { computeMultiPolygonCentroid } from '../domain/geometry/polygon-centroid';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import {
  buildOpeningBody,
  buildWallBodies,
  buildWallBody,
  buildWallHull,
  pointAlongPolyline,
  wallCenterline,
} from '../domain/geometry/wall-geometry';
import type { WireAnchor } from '../domain/geometry/wire-routing';
import { routeWire } from '../domain/geometry/wire-routing';
import type { BuildingPresetId } from '../domain/model/building-presets';
import { findBuildingPreset } from '../domain/model/building-presets';
import type {
  ActiveTool,
  EditedObjectDescriptor,
  EditorDoor,
  EditorMode,
  EditTarget,
} from '../domain/model/editor-mode';
import {
  describeEditedObject,
  editedTargetSelection,
  isPlanTool,
  isSiteEditMode,
  isToolAllowed,
  VIEW_MODE,
} from '../domain/model/editor-mode';
import type { DeviceId, DeviceKind, ElectricalDevice } from '../domain/model/electrical';
import {
  createCeilingLight,
  createWallDevice,
  DEFAULT_DEVICE_KIND,
} from '../domain/model/electrical';
import type {
  Foundation,
  UtilityEntry,
  UtilityEntryId,
  UtilitySystem,
} from '../domain/model/foundation';
import { createUtilityEntry } from '../domain/model/foundation';
import type { FurnitureCatalogId, FurnitureId, FurnitureInstance } from '../domain/model/furniture';
import { createFurniture, DEFAULT_FURNITURE_CATALOG_ID } from '../domain/model/furniture';
import type { Opening, OpeningId, OpeningPreset } from '../domain/model/openings';
import { createOpening, DEFAULT_OPENING_PRESET } from '../domain/model/openings';
import type { ElevationMarkDraft } from '../domain/model/parse-elevation-csv';
import type { PlacedObject } from '../domain/model/placed-object';
import { CAR_PLACED_OBJECT, DEFAULT_PLACED_OBJECT } from '../domain/model/placed-object';
import type { RoomLabelId, RoomTypeId } from '../domain/model/rooms';
import { createRoomLabel, isWetRoomType } from '../domain/model/rooms';
import type { RouteWarning } from '../domain/model/route-warnings';
import { collectRouteWarnings } from '../domain/model/route-warnings';
import type { UtilityRoute, UtilityRouteId } from '../domain/model/routing';
import {
  createUtilityRoute,
  DEFAULT_SEWER_DIAMETER_METERS,
  DEFAULT_TRENCH_SYSTEM,
  trenchDepthMeters,
} from '../domain/model/routing';
import type { ActiveGroup, Selection, ShapeOwner, ShapeTool } from '../domain/model/selection';
import { DEFAULT_SHAPE_TOOL, isShapeTool } from '../domain/model/selection';
import type {
  CsgOperation,
  CsgTerm,
  GroupTerm,
  Shape,
  ShapeComposition,
  ShapeId,
} from '../domain/model/shapes';
import {
  createShapeId,
  findGroupTerm,
  findShape,
  findTerm,
  flattenShapes,
  shapesExcept,
} from '../domain/model/shapes';
import type { SiteObjectState } from '../domain/model/site-object';
import type {
  Building,
  BuildingId,
  CarId,
  CarInstance,
  ElevationMark,
  MarkId,
  PadElevationMode,
  PathId,
  PathSurface,
  SitePath,
  SitePlan,
  SiteSettings,
  TreeId,
  TreeInstance,
  TreeSpecies,
} from '../domain/model/site-plan';
import {
  createBuilding,
  createCar,
  createDefaultSitePlan,
  createElevationMark,
  createSitePath,
  createTree,
  entriesOf,
  foundationOf,
  frostDepthOf,
  storeysOf,
  TREE_SPECIES_DEFAULT_SIZES,
  utilityRoutesOf,
} from '../domain/model/site-plan';
import type { SiteSettingsChanges } from '../domain/model/site-plan-edits';
import {
  addBuilding as addBuildingIn,
  addCar,
  addDevice as addDeviceIn,
  addFurniture as addFurnitureIn,
  addMark,
  addOpening as addOpeningIn,
  addPath,
  addStorey as addStoreyIn,
  addTerm,
  addTree,
  addUtilityEntry as addUtilityEntryIn,
  addUtilityRoute as addUtilityRouteIn,
  addWall as addWallIn,
  assignDeviceToPanel as assignDeviceToPanelIn,
  closeWallRing as closeWallRingIn,
  cutWallAtPoint as cutWallAtPointIn,
  findBuilding as findBuildingIn,
  findDevice as findDeviceIn,
  findFurniture as findFurnitureIn,
  findOpening as findOpeningIn,
  findWall as findWallIn,
  insertPathPoint as insertPathPointIn,
  insertUtilityRoutePoint as insertUtilityRoutePointIn,
  insertWallPoint as insertWallPointIn,
  linkSwitchToLight as linkSwitchToLightIn,
  moveMark,
  movePathPoint as movePathPointIn,
  moveTerm as moveTermIn,
  moveUtilityRoutePoint as moveUtilityRoutePointIn,
  moveWallPoint as moveWallPointIn,
  removeBuilding as removeBuildingIn,
  removeCar as removeCarFrom,
  removeDevice as removeDeviceFrom,
  removeFurniture as removeFurnitureFrom,
  removeMark,
  removeOpening as removeOpeningFrom,
  removePath as removePathFrom,
  removePathPoint as removePathPointIn,
  removeRoofZoneLabel as removeRoofZoneLabelFrom,
  removeRoomLabel as removeRoomLabelFrom,
  removeStorey as removeStoreyFrom,
  removeTerm as removeTermFrom,
  removeTree as removeTreeFrom,
  removeUtilityEntry as removeUtilityEntryFrom,
  removeUtilityRoute as removeUtilityRouteFrom,
  removeUtilityRoutePoint as removeUtilityRoutePointIn,
  removeWall as removeWallFrom,
  removeWallPoint as removeWallPointIn,
  reorderTerm as reorderTermIn,
  replaceBuilding as replaceBuildingIn,
  updateCar as replaceCarIn,
  updateShape as replaceShapeIn,
  updateTree as replaceTreeIn,
  setMarkElevation as setMarkElevationIn,
  setPathPointWidth as setPathPointWidthIn,
  setPathSegmentSurface as setPathSegmentSurfaceIn,
  setTermOperation as setTermOperationIn,
  ungroupTerm as ungroupTermIn,
  updateBuilding as updateBuildingIn,
  updateDevice as updateDeviceIn,
  updateFoundation as updateFoundationIn,
  updateFurniture as updateFurnitureIn,
  updateOpening as updateOpeningIn,
  updatePath as updatePathIn,
  updatePathWidth as updatePathWidthIn,
  updateSettings as updateSettingsWith,
  updateUtilityEntry as updateUtilityEntryIn,
  updateUtilityRoute as updateUtilityRouteIn,
  updateWall as updateWallIn,
  upsertRoofZoneLabel as upsertRoofZoneLabelIn,
  upsertRoomLabel as upsertRoomLabelIn,
  wrapTermInGroup as wrapTermInGroupIn,
} from '../domain/model/site-plan-edits';
import { parseSnapshot } from '../domain/model/snapshot';
import type { RoofCover, RoofZoneLabelId, Storey, StoreyId } from '../domain/model/storeys';
import {
  createRoofZoneLabel,
  createStorey,
  DEFAULT_ROOF_COVER,
  DEFAULT_UPPER_STOREY_HEIGHT_METERS,
  devicesOf,
  furnitureOf,
  groupsOf,
  switchLinksOf,
} from '../domain/model/storeys';
import type { Wall, WallId } from '../domain/model/walls';
import { createWall, MIN_CLOSED_WALL_POINTS, MIN_WALL_POINTS } from '../domain/model/walls';
import type { ISitePlanRepository } from '../domain/persistence/ISitePlanRepository';
import type { FlowField } from '../domain/plan-draw/draw-flow-arrows';
import type { PathDraft, PathHandleHighlight } from '../domain/plan-draw/draw-paths';
import type { UtilityRouteDraft } from '../domain/plan-draw/draw-utility-routes';
import type { PlanWallBody } from '../domain/plan-draw/draw-walls';
import type { DayWindow } from '../domain/sun/day-window';
import { clampTimeToWindow, computeDayWindow } from '../domain/sun/day-window';
import type { Sunlight } from '../domain/sun/sun-direction';
import { computeSunlight } from '../domain/sun/sun-direction';
import type { SunPosition } from '../domain/sun/sun-position';
import { computeSunPosition } from '../domain/sun/sun-position';
import { resolveMoment, today } from '../domain/sun/sun-study';
import type { AnalysisRaster } from '../domain/terrain/analysis-raster';
import { buildCutFillRaster, buildSlopeRaster } from '../domain/terrain/analysis-raster';
import { buildHeightfield } from '../domain/terrain/build-heightfield';
import type { ContourPolyline } from '../domain/terrain/contours';
import { buildContours } from '../domain/terrain/contours';
import type { CutFillReport } from '../domain/terrain/cut-fill';
import {
  computeCutFill,
  computeFootprintElevations,
  computePadElevation,
} from '../domain/terrain/cut-fill';
import {
  drapeBlendStrips,
  drapePolygons,
  PATH_SURFACE_DRAPE_COLORS,
} from '../domain/terrain/drape-polygons';
import type { Heightfield } from '../domain/terrain/heightfield';
import { sampleHeight } from '../domain/terrain/heightfield';
import type { SceneCar } from '../domain/terrain/place-cars';
import { placeCarsOnTerrain } from '../domain/terrain/place-cars';
import type { SceneFurniture } from '../domain/terrain/place-furniture';
import type { SceneTree } from '../domain/terrain/place-trees';
import { placeTreesOnTerrain } from '../domain/terrain/place-trees';
import { buildPlotCoverage } from '../domain/terrain/plot-coverage';
import type { TrenchProfile } from '../domain/terrain/trench-profile';
import { buildTrenchProfile } from '../domain/terrain/trench-profile';
import type { Meters } from '../domain/units';
import type { KeyPointSnap } from '../domain/view/object-snapping';
import type { PlanLayerKind } from '../domain/view/plan-layers';
import { ALL_PLAN_LAYERS, togglePlanLayer } from '../domain/view/plan-layers';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { createPlanViewport, DEFAULT_PIXELS_PER_METER } from '../domain/view/plan-viewport';
import { planToWorld } from '../domain/view/world-frame';
import { createIndexedDBSitePlanRepository } from '../infrastructure/IndexedDBSitePlanRepository';
import type { EditorSession } from './editor-sessions';
import { createEditorSession } from './editor-sessions';

/**
 * How often the day animation advances, and by how much. Fifty milliseconds is
 * below what reads as a step, and three minutes of sun per tick sweeps a summer
 * day in about twenty seconds — long enough to watch a shadow travel, short
 * enough not to wait for it.
 */
const SUN_ANIMATION_INTERVAL_MS = 50;
const SUN_ANIMATION_STEP_MINUTES = 3;

/** Which consumer of the site plan is on screen: the 2D plan editor or the 3D view. */
export type SitePlannerViewMode = 'plan' | 'scene';

/**
 * Which analysis is coloured over the ground, in both views at once. It is a
 * way of looking at the plan rather than part of it, so — like the sun study —
 * it stays out of the snapshot, out of storage and out of the undo stack.
 */
export type OverlayMode = 'none' | 'slope' | 'cut-fill';

/** Why the last exchange of the plan with a file did not happen; shown in the toolbar. */
export type SitePlanFileIssue = 'import-failed' | 'export-failed';

/** What the toolbar tells the user about the plan's copy in storage. */
export type SitePlanSaveState = 'saved' | 'saving' | 'error';

/**
 * How long a burst of edits to one field collapses into a single undo step.
 * Typing "12.50" into a width is one change to the user, not five.
 */
const HISTORY_GROUP_WINDOW_MS = 1000;

/**
 * Autosave debounce. Long enough that a drag, a slider sweep or a typed number
 * reaches storage once, short enough that a closed tab loses nothing worth
 * missing.
 */
const AUTOSAVE_DELAY_MS = 500;

/** Shared by every derived-geometry getter that has nothing to evaluate. */

const NO_MEASURE_POINTS: readonly Vector2[] = [];
const NO_DRAFT_PATH_POINTS: readonly Vector2[] = [];
const NO_DRAFT_UTILITY_POINTS: readonly Vector2[] = [];
/** Shared by the skeleton list whenever no gesture is running. */
const NO_SHAPES: readonly Shape[] = [];

/** A polyline is a path only once it has a segment; a single click is not one. */
const MIN_PATH_POINT_COUNT = 2;

/** A fresh plan draws into the plot itself, not into a group of it. */
const DEFAULT_ACTIVE_GROUP: ActiveGroup = { owner: 'boundary', groupId: undefined };

/**
 * Extent the terrain is sampled over while the plot has no shapes at all — the
 * quick-start plot's own size, so a mark placed before the boundary is drawn
 * still lands on a grid that covers it.
 */
const FALLBACK_SITE_BOUNDS: BoundingBox = {
  minX: 0,
  minY: 0,
  maxX: DEFAULT_SITE_WIDTH_METERS,
  maxY: DEFAULT_SITE_LENGTH_METERS,
};

/**
 * A mark starts level with the site datum: the inline input opens on it focused,
 * so the surveyed value is one keystroke away and needs no default to guess.
 */
const NEW_MARK_ELEVATION_METERS: Meters = 0;

/** A calibration is exactly two points on the picture plus the span between them. */

/** One opening resolved for the plan: its cut body, named and kinded. */
export interface PlanOpeningShape {
  readonly id: OpeningId;
  readonly kind: 'door' | 'window';
  readonly polygons: MultiPolygon;
}

/** One derived room: a region the walls enclose, with its assigned type. */
export interface BuildingRoom {
  readonly storeyId: StoreyId;
  readonly polygons: MultiPolygon;
  readonly areaSquareMeters: number;
  readonly centroid: Vector2 | undefined;
  readonly roomTypeId: RoomTypeId | undefined;
  readonly labelId: RoomLabelId | undefined;
  readonly isWet: boolean;
}

/** One region of a storey's exposed ceiling, with the cover pinned to it. */
export interface RoofZoneScene {
  readonly storeyId: StoreyId;
  readonly polygons: MultiPolygon;
  readonly cover: RoofCover;
  readonly areaSquareMeters: number;
  readonly centroid: Vector2 | undefined;
  readonly labelId: RoofZoneLabelId | undefined;
}

/** One device resolved onto the plan, its symbol point placed. */
export interface PlanDevice {
  readonly id: DeviceId;
  readonly kind: DeviceKind;
  readonly position: Vector2;
}

/** One derived wire run, panel→consumer or switch→light. */
export interface PlanWire {
  readonly points: readonly Vector2[];
  /** A switch→light link draws dashed; a circuit run draws solid. */
  readonly isSwitchLink: boolean;
}

/** One storey resolved for drawing and stacking — see `buildingScenes`. */
export interface StoreyScene {
  readonly storey: Storey;
  readonly level: number;
  /** Ground: the building composition's fold; upper: the hull of its walls. */
  readonly footprint: MultiPolygon;
  /** Bottom of this storey's walls; nothing while the building has no pad. */
  readonly baseElevation: Meters | undefined;
  readonly wallShapes: readonly PlanWallBody[];
  readonly wallBodies: MultiPolygon;
  readonly openingShapes: readonly PlanOpeningShape[];
  readonly rooms: readonly BuildingRoom[];
  /** This storey's exposed ceiling — what no storey above covers — zoned. */
  readonly roofZones: readonly RoofZoneScene[];
  readonly furniture: readonly FurnitureInstance[];
  readonly devices: readonly PlanDevice[];
  /** The wiring, derived per §8: along the walls wherever they connect. */
  readonly wires: readonly PlanWire[];
}

/** One utility entry resolved onto the plan — where its system enters the house. */
export interface PlanUtilityEntry {
  readonly id: UtilityEntryId;
  readonly system: UtilitySystem;
  readonly position: Vector2;
}

/** One building resolved against the terrain — see `buildingScenes`. */
export interface BuildingScene {
  readonly building: Building;
  readonly polygons: MultiPolygon;
  readonly padElevation: Meters | undefined;
  readonly cutFill: CutFillReport | undefined;
  readonly foundation: Foundation;
  /** Concrete estimate for the panel; piers are not estimated (no count yet). */
  readonly foundationVolumeCubicMeters: number | undefined;
  /** Entries the footprint can actually place — nothing without an outline. */
  readonly entryPoints: readonly PlanUtilityEntry[];
  /** The storeys resolved bottom-up; index = level. */
  readonly storeys: readonly StoreyScene[];
}

/** History groups of the house fields, so a typed number stays one step to undo. */
const MANUAL_PAD_HISTORY_GROUP = 'house:manual-pad';
const WALL_HEIGHT_HISTORY_GROUP = 'house:wall-height';
const WALL_HISTORY_GROUP = 'wall';
const OPENING_HISTORY_GROUP = 'opening';
const FURNITURE_HISTORY_GROUP = 'furniture';
const DEVICE_HISTORY_GROUP = 'device';
const FOUNDATION_HISTORY_GROUP = 'foundation';
const ENTRY_HISTORY_GROUP = 'entry';
const ROUTE_HISTORY_GROUP = 'route';

/**
 * The foundation stands this much proud of the walls all round — the real
 * цоколь detail, and what keeps its faces off the walls' in the depth buffer.
 */
const FOUNDATION_LEDGE_METERS = 0.05;
/** The visible build-up of a terrace deck or a green roof's planting bed. */
const ROOF_COVER_THICKNESS_METERS = 0.08;
/** New entries land spaced along the outline instead of stacking at its start. */
const ENTRY_SPACING_METERS = 3;

const PERCENT_SCALE = 100;

/** A drawn wall's last click this close to its first reads as closing the ring. */
const DRAWN_RING_SEAM_EPSILON_METERS = 0.01;

export class SitePlannerStore {
  viewMode: SitePlannerViewMode = 'plan';

  /**
   * The plan is held section by section, each as a reference: sections are
   * immutable, so replacing one (moving a tree) leaves the computations that
   * depend on the others (terrain, boundary geometry) valid.
   */
  boundary: ShapeComposition;
  elevationMarks: readonly ElevationMark[];
  buildings: readonly Building[];
  trees: readonly TreeInstance[];
  cars: readonly CarInstance[];
  paths: readonly SitePath[];
  utilityRoutes: readonly UtilityRoute[];
  settings: SiteSettings;

  /** Editor state — transient, never part of the persisted plan. */
  activeTool: ActiveTool = 'select';
  /**
   * The drawing tool the palette's shape button stands for. Rectangle and circle
   * share that button, so it has to remember which of them was reached for last —
   * by the button's own flyout or by the R and C keys alike.
   */
  armedShapeTool: ShapeTool = DEFAULT_SHAPE_TOOL;
  overlayMode: OverlayMode = 'none';
  selection: Selection | undefined = undefined;
  /** Ad-hoc ruler anchors, consumed as consecutive pairs; cleared on tool change. */
  measurePoints: readonly Vector2[] = NO_MEASURE_POINTS;
  /** Where a newly drawn shape joins the tree, chosen in the structure panel. */
  activeGroup: ActiveGroup = DEFAULT_ACTIVE_GROUP;
  /**
   * The shape a pointer gesture is currently shaping, before it reaches the
   * plan. Keeping it apart from the model is what stops every pointer move from
   * re-running the boolean fold — the edit lands once, on pointer up.
   */
  draftShape: Shape | undefined = undefined;
  /**
   * The mark a pointer gesture is moving, for the same reason a shape has a
   * draft: the terrain is rebuilt from the marks, and rebuilding it on every
   * pointer move would make dragging a flag cost a full TIN rasterisation.
   */
  draftMark: ElevationMark | undefined = undefined;
  /**
   * The key points a Shift-held gesture has joined, published so the plan can
   * show what it has caught. Transient like the drafts: the controller sets it
   * while a gesture runs and drops it when the pointer comes up.
   */
  activeKeyPointSnap: KeyPointSnap | undefined = undefined;
  /** The mark whose elevation is being typed into the field floating by its flag. */
  elevationInputMarkId: MarkId | undefined = undefined;
  /**
   * The polyline of the path being clicked out, before it reaches the plan. A
   * path is committed as a whole — one step to undo — so the points live here
   * until the user finishes the line.
   */
  draftPathPoints: readonly Vector2[] = NO_DRAFT_PATH_POINTS;
  /**
   * The polyline of the trench being clicked out, before it reaches the plan —
   * the path draft's sibling, committed as a whole for the same one-step undo.
   */
  draftUtilityPoints: readonly Vector2[] = NO_DRAFT_UTILITY_POINTS;
  /**
   * The system the trench tool digs for next, chosen from the palette's flyout.
   * It stays armed between routes the way the placed-object choice does.
   */
  nextUtilitySystem: UtilitySystem = DEFAULT_TRENCH_SYSTEM;
  /**
   * What the placing tool puts on the plan next, chosen from the flyout of the
   * palette's object button. It stays where it is between clicks: placing a row
   * of the same thing is the common case, and a list to pick from before every
   * click would be in the way of it.
   */
  nextPlacedObject: PlacedObject = DEFAULT_PLACED_OBJECT;
  /** Pointer position in plan metres, for the status-bar readout. */
  cursorPlanPoint: Vector2 | undefined = undefined;
  /**
   * The polyline handle under or held by the pointer — a path's or a trench's,
   * whichever is selected — echoed back as its highlight.
   */
  pathHandleHighlight: PathHandleHighlight | undefined = undefined;
  /** View or one opened editor; see `modes.md` for the contract. */
  editorMode: EditorMode = VIEW_MODE;
  /**
   * The open editor's own transient state (`editor-sessions.ts`), living
   * exactly as long as the editor visit. Nothing while viewing.
   */
  editorSession: EditorSession | undefined = undefined;
  /**
   * Whether the properties panel is being handed the keyboard. A shape dragged
   * onto the plan is sized by eye; the panel takes focus so the exact dimension
   * can be typed straight after, and clears the flag once it has.
   */
  isPropertiesFocusPending = false;
  /**
   * Mirror of the render session's viewport. The session owns it; the store
   * publishes it so the overlays React draws over the canvas — the inline
   * elevation field — can follow a pan or a zoom.
   */
  viewport: PlanViewport = createPlanViewport(0, 0);
  /**
   * Mirror of the 3D camera's orbit angle, in degrees (`orbit-camera.ts`). The
   * camera owns it; the session publishes it on the frames the view moved, so
   * the compass React draws over the canvas can turn with the camera without a
   * render loop of its own.
   */
  cameraYawDegrees = 0;
  /**
   * Which layers the plan is drawn with. A way of looking at the plan rather
   * than part of it — hiding the grid before an export must not change the
   * document — so it stays out of the snapshot, out of storage and out of undo.
   */
  visibleLayers: ReadonlySet<PlanLayerKind> = ALL_PLAN_LAYERS;
  fileIssue: SitePlanFileIssue | undefined = undefined;

  /**
   * The sun study — the date and the time of day the 3D view is lit at, and
   * whether the day is playing. Ephemeral by design: it is a way of looking at
   * the plan rather than part of it, so it stays out of the snapshot, out of
   * storage and out of the undo stack.
   */
  isSunStudyOpen = false;
  sunDate: Temporal.PlainDate;
  isSunAnimating = false;
  /**
   * The time the user has chosen, before it is fitted to the daylight of the
   * day being studied. Nothing until they choose one: a study opened on a fresh
   * date starts at midday of that date's own daylight rather than at a time
   * carried over from another season.
   */
  sunTimeOverrideMinutes: number | undefined = undefined;

  saveState: SitePlanSaveState = 'saved';
  /**
   * Mirrors of the history's stacks. The history is a plain closure, so its
   * depth is not observable by itself — the two flags are refreshed at the one
   * place that touches it (precedent: `StereometryStore`).
   */
  canUndo = false;
  canRedo = false;

  private readonly repository: ISitePlanRepository;
  private readonly history = createHistory<SitePlan>();
  /** The plan as it was before an announced edit, held until that edit lands. */
  private pendingHistoryPlan: SitePlan | undefined = undefined;
  private lastRecordedGroupKey: string | undefined = undefined;
  private lastRecordedAtMs = 0;
  private readonly disposeHistoryCommit: IReactionDisposer;
  private disposeAutosave: IReactionDisposer | undefined = undefined;
  private sunAnimationTimer: ReturnType<typeof setInterval> | undefined = undefined;
  private saveRequestId = 0;
  private isDisposed = false;

  constructor(repository: ISitePlanRepository = createIndexedDBSitePlanRepository()) {
    this.repository = repository;

    const defaultPlan = createDefaultSitePlan();

    this.boundary = defaultPlan.boundary;
    this.elevationMarks = defaultPlan.elevationMarks;
    this.buildings = defaultPlan.buildings;
    this.trees = defaultPlan.trees;
    this.cars = defaultPlan.cars;
    this.paths = defaultPlan.paths;
    this.utilityRoutes = utilityRoutesOf(defaultPlan);
    this.settings = defaultPlan.settings;
    this.sunDate = today(defaultPlan.settings.location);

    makeAutoObservable<
      SitePlannerStore,
      | 'repository'
      | 'history'
      | 'pendingHistoryPlan'
      | 'lastRecordedGroupKey'
      | 'lastRecordedAtMs'
      | 'disposeHistoryCommit'
      | 'disposeAutosave'
      | 'sunAnimationTimer'
      | 'saveRequestId'
      | 'isDisposed'
    >(
      this,
      {
        repository: false,
        history: false,
        pendingHistoryPlan: false,
        lastRecordedGroupKey: false,
        lastRecordedAtMs: false,
        disposeHistoryCommit: false,
        disposeAutosave: false,
        sunAnimationTimer: false,
        saveRequestId: false,
        isDisposed: false,
        sunDate: observableRef,
        boundary: observableRef,
        elevationMarks: observableRef,
        buildings: observableRef,
        trees: observableRef,
        cars: observableRef,
        paths: observableRef,
        utilityRoutes: observableRef,
        draftUtilityPoints: observableRef,
        nextPlacedObject: observableRef,
        settings: observableRef,
        activeGroup: observableRef,
        selection: observableRef,
        measurePoints: observableRef,
        draftShape: observableRef,
        draftMark: observableRef,
        activeKeyPointSnap: observableRef,
        cursorPlanPoint: observableRef,
        pathHandleHighlight: observableRef,
        editorMode: observableRef,
        editorSession: observableRef,
        viewport: observableRef,
        draftPathPoints: observableRef,
        visibleLayers: observableRef,
      },
      { autoBind: true }
    );

    this.disposeHistoryCommit = reaction(() => this.snapshot, this.commitPendingHistory);

    this.initialize().catch(this.reportSaveFailure);
  }

  get snapshot(): SitePlan {
    return {
      boundary: this.boundary,
      elevationMarks: this.elevationMarks,
      buildings: this.buildings,
      trees: this.trees,
      cars: this.cars,
      paths: this.paths,
      utilityRoutes: this.utilityRoutes,
      settings: this.settings,
    };
  }

  /** The plot as the boolean fold leaves it: outer rings plus their holes. */
  get boundaryPolygons(): MultiPolygon {
    return evaluateComposition(this.boundary);
  }

  /** Inward offset of the plot by the setback distance — drawn as the dashed line. */
  get setbackRings(): MultiPolygon {
    return offsetPolygons(this.boundaryPolygons, -this.settings.setbackMeters);
  }

  /** One ribbon per path, in plan order, so a path keeps its identity downstream. */
  get pathRibbons(): readonly PathRibbon[] {
    return buildPathRibbons(this.paths);
  }

  /** Every ribbon as one multi-polygon — what the 3D view drapes over the ground. */
  get pathRibbonPolygons(): MultiPolygon {
    return this.pathRibbons.flatMap(ribbon => ribbon.polygons);
  }

  /**
   * The live preview of the path being clicked out: the placed points with the
   * cursor as their provisional end, and the ribbon they would become. The
   * cursor is only read while a line is in flight, so pointer moves repaint the
   * plan for this and for nothing else.
   */
  get draftPathPreview(): PathDraft | undefined {
    const { draftPathPoints } = this;

    if (draftPathPoints.length === 0) {
      return undefined;
    }

    const cursor = this.cursorPlanPoint;
    const points = isNil(cursor) ? draftPathPoints : [...draftPathPoints, cursor];

    return { points, ribbon: buildPathRibbon(points, DEFAULT_PATH_WIDTH_METERS) };
  }

  /** The live preview of the trench being clicked out, cursor at its tail. */
  get draftUtilityPreview(): UtilityRouteDraft | undefined {
    const { draftUtilityPoints } = this;

    if (draftUtilityPoints.length === 0) {
      return undefined;
    }

    const cursor = this.cursorPlanPoint;

    return {
      system: this.nextUtilitySystem,
      points: isNil(cursor) ? draftUtilityPoints : [...draftUtilityPoints, cursor],
    };
  }

  /** The plot's frost depth — what every burial norm measures from (R17). */
  get frostDepthMeters(): Meters {
    return frostDepthOf(this.settings);
  }

  /**
   * Every trench resolved against the terrain: the norm burial for its system,
   * a sewer's gravity fall, the digging volume. One map for the panels, the
   * warning pass and the report alike.
   */
  get trenchProfiles(): ReadonlyMap<UtilityRouteId, TrenchProfile> {
    const { heightfield, frostDepthMeters } = this;
    const profiles = new Map<UtilityRouteId, TrenchProfile>();

    for (const route of this.utilityRoutes) {
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
      routes: this.utilityRoutes,
      profiles: this.trenchProfiles,
      burialDepths: new Map(
        this.utilityRoutes.map(route => [
          route.id,
          trenchDepthMeters(route.system, frostDepthMeters),
        ])
      ),
      driveablePolygons: this.pathRibbonPolygons,
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

  /** Extent the terrain is sampled over: the plot's own bounding box. */
  get siteBounds(): BoundingBox {
    return computeMultiPolygonBounds(this.boundaryPolygons) ?? FALLBACK_SITE_BOUNDS;
  }

  /**
   * The interpolated terrain. It depends on the marks and on the plot alone, so
   * moving a tree or opening a panel leaves the cached grid untouched.
   */
  get heightfield(): Heightfield {
    return buildHeightfield({
      bounds: this.siteBounds,
      marks: this.elevationMarks,
      targetResolution: this.settings.heightfieldTargetResolution,
    });
  }

  get contours(): readonly ContourPolyline[] {
    return buildContours(this.heightfield, this.settings.contourIntervalMeters);
  }

  /** Which grid samples the plot covers — what the analyses are read over. */
  get plotCoverage(): Float32Array {
    return buildPlotCoverage(this.heightfield, this.boundaryPolygons);
  }

  /**
   * The active analysis, painted into pixels once. Both views take this very
   * raster — the plan draws it as an image, the 3D view uploads it as a texture
   * — so a colour can never mean one thing on the plan and another in 3D.
   */
  get analysisRaster(): AnalysisRaster | undefined {
    switch (this.overlayMode) {
      case 'none':
        return undefined;
      case 'slope':
        return buildSlopeRaster(this.heightfield, this.plotCoverage);
      case 'cut-fill': {
        const pads = this.buildingScenes.filter(scene => !isNil(scene.padElevation));

        // Nothing to level without a building: the earthworks are the cost of
        // its pad, and there is no pad until a footprint is drawn.
        return pads.length === 0
          ? undefined
          : buildCutFillRaster(
              this.heightfield,
              pads.map(scene => ({
                polygons: scene.polygons,
                padElevation: scene.padElevation ?? 0,
              }))
            );
      }
      default:
        return assertNever(this.overlayMode);
    }
  }

  /**
   * The ground the runoff arrows are drawn over. Only the slope overlay reads
   * runoff, so nothing is sampled for the arrows in any other mode.
   */
  get flowField(): FlowField | undefined {
    return this.overlayMode === 'slope'
      ? { field: this.heightfield, coverage: this.plotCoverage }
      : undefined;
  }

  /**
   * Every building resolved against the terrain: its footprint polygons, the
   * pad it is levelled onto and the earthworks of levelling it. One computed
   * for the lot, because everything downstream — the plan's labels, the panel,
   * the 3D meshes, the cut/fill overlay — walks the same list.
   *
   * A building is never deformed by the ground — it is levelled onto a pad,
   * and the ground is what gets cut and filled to meet it (`terrain/cut-fill.ts`).
   */
  get buildingScenes(): readonly BuildingScene[] {
    return this.buildings.map(building => {
      const polygons = evaluateComposition(building.composition);
      const padElevation =
        polygons.length === 0
          ? undefined
          : computePadElevation({
              field: this.heightfield,
              polygons,
              mode: building.padElevationMode,
              manualPadElevation: building.manualPadElevation,
            });

      const foundation = foundationOf(building);

      return {
        building,
        polygons,
        padElevation,
        cutFill: isNil(padElevation)
          ? undefined
          : computeCutFill(this.heightfield, polygons, padElevation),
        foundation,
        foundationVolumeCubicMeters:
          polygons.length === 0 ? undefined : foundationVolumeCubicMeters(foundation, polygons),
        entryPoints: entriesOf(building).flatMap(entry => {
          const position = pointOnOutline(polygons, entry.outlineOffsetMeters);

          return isNil(position) ? [] : [{ id: entry.id, system: entry.system, position }];
        }),
        storeys: deriveStoreyScenes(building, polygons, padElevation),
      };
    });
  }

  /** The earthworks of every building added up — what the overlay legend reports. */
  get totalCutFill(): CutFillReport | undefined {
    const reports = this.buildingScenes.flatMap(scene =>
      isNil(scene.cutFill) ? [] : [scene.cutFill]
    );

    if (reports.length === 0) {
      return undefined;
    }

    return {
      cutVolumeCubicMeters: reports.reduce((sum, report) => sum + report.cutVolumeCubicMeters, 0),
      fillVolumeCubicMeters: reports.reduce((sum, report) => sum + report.fillVolumeCubicMeters, 0),
    };
  }

  /**
   * The buildings as the 3D view draws them, one mesh: every storey's walls
   * extruded at its own level (openings cut, sills and lintels kept), the
   * whole footprint as the fallback for a building with no walls at all.
   */
  get buildingsGeometry(): LitMesh | undefined {
    const meshes = this.buildingScenes.flatMap(scene => {
      const { building, polygons, padElevation, storeys } = scene;

      if (isNil(padElevation) || polygons.length === 0) {
        return [];
      }

      const elevations = computeFootprintElevations(this.heightfield, polygons);

      if (isNil(elevations)) {
        return [];
      }

      const apronBaseElevation =
        Math.min(elevations.minElevation, padElevation) - APRON_DEPTH_METERS;
      const hasAnyWalls = storeys.some(storeyScene => storeyScene.wallBodies.length > 0);

      // A building drawn only as a footprint keeps the classic massing block.
      if (!hasAnyWalls) {
        return [
          extrudeFootprint({
            polygons,
            padElevation,
            wallHeight: building.wallHeight,
            // A pad sunk below the ground it covers still needs a skirt going
            // down, so the apron starts from whichever of the two is lower.
            apronBaseElevation,
          }),
        ];
      }

      return storeys.flatMap(storeyScene => {
        const { storey, level, wallBodies, openingShapes, baseElevation } = storeyScene;

        if (isNil(baseElevation) || wallBodies.length === 0) {
          return [];
        }

        // Openings cut full-height slots; the masonry under each sill and the
        // lintel over each head come back as closed prisms.
        const slotted = subtractPolygons(
          wallBodies,
          openingShapes.flatMap(shape => shape.polygons)
        );
        const walls = slotted.length > 0 ? slotted : wallBodies;
        const shell =
          level === 0
            ? extrudeFootprint({
                polygons: walls,
                padElevation: baseElevation,
                wallHeight: storey.heightMeters,
                apronBaseElevation,
              })
            : extrudePrism({
                polygons: walls,
                baseElevation,
                topElevation: baseElevation + storey.heightMeters,
              });
        const pieces = storey.openings.flatMap(opening => {
          const shape = openingShapes.find(candidate => candidate.id === opening.id);

          if (isNil(shape) || shape.polygons.length === 0) {
            return [];
          }

          const prisms: LitMesh[] = [];

          if (opening.sillMeters > 0) {
            prisms.push(
              extrudePrism({
                polygons: shape.polygons,
                baseElevation,
                topElevation: baseElevation + Math.min(opening.sillMeters, storey.heightMeters),
              })
            );
          }

          if (opening.headMeters < storey.heightMeters) {
            prisms.push(
              extrudePrism({
                polygons: shape.polygons,
                baseElevation: baseElevation + opening.headMeters,
                topElevation: baseElevation + storey.heightMeters,
              })
            );
          }

          return prisms;
        });

        return [shell, ...pieces];
      });
    });

    return mergeLitMeshes(meshes);
  }

  /**
   * The green and terrace covers laid over the exposed ceilings, one thin
   * slab each — the plain membrane stays the roof the extrusion already has.
   */
  get roofOverlaysGeometry(): RoofOverlayGeometry {
    const green: LitMesh[] = [];
    const terrace: LitMesh[] = [];

    for (const scene of this.buildingScenes) {
      for (const storeyScene of scene.storeys) {
        const { baseElevation, storey } = storeyScene;

        if (isNil(baseElevation)) {
          continue;
        }

        const ceiling = baseElevation + storey.heightMeters;

        for (const zone of storeyScene.roofZones) {
          if (zone.cover === 'membrane' || zone.polygons.length === 0) {
            continue;
          }

          const slab = extrudePrism({
            polygons: zone.polygons,
            baseElevation: ceiling,
            topElevation: ceiling + ROOF_COVER_THICKNESS_METERS,
          });

          (zone.cover === 'green' ? green : terrace).push(slab);
        }
      }
    }

    return { green: mergeLitMeshes(green), terrace: mergeLitMeshes(terrace) };
  }

  /**
   * Every placed piece as a box at its storey's level plus its own elevation,
   * split by category so plumbing reads white against the wooden furniture.
   */
  /**
   * Every placed piece as a template instance for the 3D view — the storey's
   * floor plus the piece's own elevation baked into the world point, the plan
   * turn carried as-is (the car's convention, which the shader shares).
   */
  get sceneFurniture(): readonly SceneFurniture[] {
    const instances: SceneFurniture[] = [];

    for (const scene of this.buildingScenes) {
      for (const storeyScene of scene.storeys) {
        const { baseElevation } = storeyScene;

        if (isNil(baseElevation)) {
          continue;
        }

        for (const item of storeyScene.furniture) {
          instances.push({
            catalogId: item.catalogId,
            position: planToWorld(item.position, baseElevation + item.elevationMeters),
            rotationDegrees: item.rotationDegrees,
          });
        }
      }
    }

    return instances;
  }

  /**
   * The foundations as the 3D view pours them: one concrete solid per
   * building from below the pad up to the цоколь, its footprint a ledge
   * proud of the walls — the real detail that also keeps the two solids'
   * faces from fighting over the same pixels.
   */
  get foundationsGeometry(): LitMesh | undefined {
    const meshes = this.buildingScenes.flatMap(scene => {
      const { polygons, padElevation, foundation } = scene;
      const height = foundation.depthMeters + foundation.heightAboveGroundMeters;

      if (isNil(padElevation) || polygons.length === 0 || height <= 0) {
        return [];
      }

      const outset = offsetPolygons(polygons, FOUNDATION_LEDGE_METERS);

      if (outset.length === 0) {
        return [];
      }

      const elevations = computeFootprintElevations(this.heightfield, outset);

      if (isNil(elevations)) {
        return [];
      }

      const baseElevation = padElevation - foundation.depthMeters;

      return [
        extrudeFootprint({
          polygons: outset,
          padElevation: baseElevation,
          wallHeight: height,
          apronBaseElevation: Math.min(elevations.minElevation, baseElevation) - APRON_DEPTH_METERS,
        }),
      ];
    });

    return mergeLitMeshes(meshes);
  }

  /**
   * The trees as the 3D view stands them: on the interpolated terrain, so a
   * surveyed elevation moves the whole planting with the ground (A4).
   */
  get sceneTrees(): readonly SceneTree[] {
    return placeTreesOnTerrain(this.trees, this.heightfield);
  }

  /** The cars as the 3D view parks them: on the terrain, facing where the plan says. */
  get sceneCars(): readonly SceneCar[] {
    return placeCarsOnTerrain(this.cars, this.heightfield);
  }

  /** The paths as the 3D view lays them: their ribbons draped over the terrain. */
  get pathDrapeGeometry(): PathDrapeGeometry {
    const bySurface = (surface: PathSurface): MultiPolygon =>
      this.pathRibbons.flatMap(ribbon =>
        ribbon.pieces.filter(piece => piece.surface === surface).flatMap(piece => piece.polygons)
      );

    return {
      dirt: drapePolygons({
        polygons: bySurface('dirt'),
        field: this.heightfield,
        elevationOffset: PATH_DRAPE_OFFSET_METERS,
      }),
      asphalt: drapePolygons({
        polygons: bySurface('asphalt'),
        field: this.heightfield,
        elevationOffset: PATH_DRAPE_OFFSET_METERS,
      }),
      blend: drapeBlendStrips({
        strips: this.pathRibbons.flatMap(ribbon =>
          ribbon.seamBlends.map(blend => ({
            polygons: blend.polygons,
            fromColor: PATH_SURFACE_DRAPE_COLORS[blend.fromSurface],
            toColor: PATH_SURFACE_DRAPE_COLORS[blend.toSurface],
            start: blend.start,
            end: blend.end,
          }))
        ),
        field: this.heightfield,
        elevationOffset: PATH_DRAPE_OFFSET_METERS,
      }),
    };
  }

  get selectedTree(): TreeInstance | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'tree'
      ? undefined
      : this.trees.find(tree => tree.id === selection.treeId);
  }

  get selectedCar(): CarInstance | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'car'
      ? undefined
      : this.cars.find(car => car.id === selection.carId);
  }

  get selectedBuilding(): Building | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'building'
      ? undefined
      : findBuildingIn(this.buildings, selection.buildingId);
  }

  get selectedPath(): SitePath | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'path'
      ? undefined
      : this.paths.find(path => path.id === selection.pathId);
  }

  get selectedUtilityRoute(): UtilityRoute | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'utilityRoute'
      ? undefined
      : this.utilityRoutes.find(route => route.id === selection.routeId);
  }

  get selectedMark(): ElevationMark | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'mark'
      ? undefined
      : findMark(this.elevationMarks, selection.markId);
  }

  /** The mark the floating elevation field belongs to, or nothing while it is closed. */
  get elevationInputMark(): ElevationMark | undefined {
    const { elevationInputMarkId } = this;

    return isNil(elevationInputMarkId)
      ? undefined
      : findMark(this.elevationMarks, elevationInputMarkId);
  }

  get selectedShape(): Shape | undefined {
    const { selection } = this;

    if (isNil(selection) || selection.kind !== 'shape') {
      return undefined;
    }

    const composition = resolveComposition(selection.owner, this.boundary, this.buildings);

    return isNil(composition) ? undefined : findShape(composition, selection.shapeId);
  }

  /**
   * The group the structure panel has selected, with the operation it joins its
   * parent fold with — the two things the properties panel shows for it.
   */
  get selectedGroupTerm(): GroupTerm | undefined {
    const { selection } = this;

    if (isNil(selection) || selection.kind !== 'group') {
      return undefined;
    }

    const composition = resolveComposition(selection.owner, this.boundary, this.buildings);

    return isNil(composition) ? undefined : findGroupTerm(composition, selection.groupId);
  }

  /**
   * Where a shape drawn now would actually land. The chosen group is checked
   * against the plan every time it is read: an undo, an import or the removal of
   * an ancestor can take a group away, and a shape aimed at one that is no longer
   * there has to land in the root of its composition rather than nowhere at all.
   */
  get resolvedActiveGroup(): ActiveGroup {
    const { activeGroup } = this;
    const { owner, groupId } = activeGroup;

    if (isNil(groupId)) {
      return activeGroup;
    }

    const composition = resolveComposition(owner, this.boundary, this.buildings);
    const isPresent = !isNil(composition) && !isNil(findGroupTerm(composition, groupId));

    return isPresent ? activeGroup : { owner, groupId: undefined };
  }

  /** Every parametric shape on the plan, the plot's terms before the house's. */
  get allShapes(): readonly Shape[] {
    return [
      ...flattenShapes(this.boundary),
      ...this.buildings.flatMap(building => flattenShapes(building.composition)),
    ];
  }

  /**
   * The shapes drawn as skeletons while a gesture is running: every one of both
   * groups but the one being shaped. Nothing while nothing is in flight — the
   * skeletons are there to aim at, and a still plan has nothing to aim.
   */
  get gestureSkeletonShapes(): readonly Shape[] {
    const { draftShape } = this;

    return isNil(draftShape) ? NO_SHAPES : shapesExcept(this.allShapes, draftShape.id);
  }

  /** 100 % is the zoom a freshly opened plan starts at. */
  get zoomPercent(): number {
    return Math.round((this.viewport.pixelsPerMeter / DEFAULT_PIXELS_PER_METER) * PERCENT_SCALE);
  }

  /** Sunrise and sunset of the studied date — the span the time slider covers. */
  get sunDayWindow(): DayWindow {
    return computeDayWindow({ date: this.sunDate, location: this.settings.location });
  }

  /** The studied time of day, always inside the daylight of the studied date. */
  get sunTimeMinutes(): number {
    const { sunDayWindow, sunTimeOverrideMinutes } = this;

    return clampTimeToWindow(sunTimeOverrideMinutes ?? middleOf(sunDayWindow), sunDayWindow);
  }

  get sunMoment(): Temporal.ZonedDateTime {
    return resolveMoment({
      date: this.sunDate,
      timeMinutes: this.sunTimeMinutes,
      timeZoneId: this.settings.location.timeZoneId,
    });
  }

  get sunPosition(): SunPosition {
    const { latitudeDegrees, longitudeDegrees } = this.settings.location;

    return computeSunPosition({ moment: this.sunMoment, latitudeDegrees, longitudeDegrees });
  }

  /**
   * The light the 3D view is rendered with. It depends on the studied moment and
   * on the site's location alone, so it survives every edit to the geometry —
   * and every edit to the geometry leaves it untouched.
   */
  get sunlight(): Sunlight {
    return computeSunlight(this.sunPosition, this.settings.location.northOffsetDegrees);
  }

  /**
   * Edits the settings section. Fields typed digit by digit — a latitude, a
   * setback — pass their own `groupKey`, so a burst of keystrokes stays one step
   * to undo, the way the properties panel writes a dimension.
   */
  updateSettings(changes: SiteSettingsChanges, groupKey?: string): void {
    this.pushHistory(groupKey);
    this.settings = updateSettingsWith(this.settings, changes);
  }

  /**
   * Turns the plot's north (`domain/view/north-offset.ts`). Unlike every other
   * settings edit it announces no history step of its own: north is set both by
   * dragging the compass dial and by typing an azimuth, and each of those
   * announces the step it belongs to — the dial once, when the pointer goes
   * down, the way every other drag on the plan does.
   */
  setNorthOffsetDegrees(northOffsetDegrees: number): void {
    this.settings = updateSettingsWith(this.settings, { location: { northOffsetDegrees } });
  }

  /** Shows or hides one layer of the plan; the 3D view keeps its own contents. */
  toggleLayerVisibility(layer: PlanLayerKind): void {
    this.visibleLayers = togglePlanLayer(this.visibleLayers, layer);
  }

  /**
   * Adopts a whole plan read from a file, as one step to undo. Adopting a plan
   * discards whatever edit was announced before it, so the state this
   * replacement is undone to is armed afterwards rather than before.
   */
  replacePlan(plan: SitePlan): void {
    const previousPlan = this.snapshot;

    this.applySnapshot(plan);
    this.pendingHistoryPlan = previousPlan;
    this.selection = undefined;
    this.clearGestureState();
  }

  /** Reads a picked JSON file into the plan; anything unreadable is reported. */
  async importPlanFile(file: File): Promise<void> {
    this.fileIssue = undefined;

    try {
      const text = await file.text();

      runInAction(() => this.adoptSerializedPlan(text));
    } catch {
      runInAction(() => {
        this.fileIssue = 'import-failed';
      });
    }
  }

  /** The export could not produce a file — an image the browser refused to encode. */
  reportExportFailure(): void {
    this.fileIssue = 'export-failed';
  }

  dismissFileIssue(): void {
    this.fileIssue = undefined;
  }

  applySnapshot(plan: SitePlan): void {
    this.boundary = plan.boundary;
    this.elevationMarks = plan.elevationMarks;
    this.buildings = plan.buildings;
    this.trees = plan.trees;
    this.cars = plan.cars;
    this.paths = plan.paths;
    this.utilityRoutes = utilityRoutesOf(plan);
    this.settings = plan.settings;

    // A plan that arrives whole — restored, or read from storage — discards the
    // state an announced edit was going to be undone to.
    this.pendingHistoryPlan = undefined;
    this.lastRecordedGroupKey = undefined;
  }

  /**
   * Announces an edit: the plan as it is now becomes the state that edit will be
   * undone to. It reaches the undo stack only once the plan actually changes, so
   * a click that selects nothing and a gesture that puts everything back where
   * it was leave no step behind.
   *
   * Callers that edit the plan once — adding a term, toggling an operation —
   * announce it inside their own action. A gesture or a typed number arrives as
   * a stream of edits instead and announces once, at the start: the interaction
   * controller before it takes hold of a shape, a panel before it writes a
   * field, passing that field as `groupKey` so a burst of keystrokes stays one
   * step.
   */
  pushHistory(groupKey?: string): void {
    const nowMs = performance.now();
    const isGroupedRepeat =
      !isNil(groupKey) &&
      groupKey === this.lastRecordedGroupKey &&
      nowMs - this.lastRecordedAtMs < HISTORY_GROUP_WINDOW_MS;

    this.lastRecordedGroupKey = groupKey;
    this.lastRecordedAtMs = nowMs;

    if (!isGroupedRepeat) {
      this.pendingHistoryPlan = this.snapshot;
    }
  }

  undo(): void {
    this.restore(this.history.undo(this.snapshot));
  }

  redo(): void {
    this.restore(this.history.redo(this.snapshot));
  }

  setViewMode(viewMode: SitePlannerViewMode): void {
    this.viewMode = viewMode;

    // The editing modes are 2D contracts; the 3D view always shows the whole plan.
    if (viewMode === 'scene' && this.editorMode.kind === 'edit') {
      this.exitEditMode();
    }

    // Nothing watches the sun outside the 3D view, and a timer left running
    // would keep recomputing a light nobody is looking at.
    if (viewMode !== 'scene') {
      this.stopSunAnimation();
    }

    // Cut/fill is an earthworks planning readout — it belongs to the plan, so
    // the 3D view opens with no overlay rather than a meaningless colouring.
    if (viewMode === 'scene' && this.overlayMode === 'cut-fill') {
      this.overlayMode = 'none';
    }
  }

  /** The Tab hotkey: the plan and the 3D view are two windows onto one plan. */
  toggleViewMode(): void {
    this.setViewMode(this.viewMode === 'plan' ? 'scene' : 'plan');
  }

  /** The ☀ toolbar button: shows or hides the sun study bar over the 3D view. */
  toggleSunStudy(): void {
    this.isSunStudyOpen = !this.isSunStudyOpen;

    if (!this.isSunStudyOpen) {
      this.stopSunAnimation();
    }
  }

  setSunDate(sunDate: Temporal.PlainDate): void {
    this.sunDate = sunDate;
  }

  setSunTimeMinutes(timeMinutes: number): void {
    this.sunTimeOverrideMinutes = timeMinutes;
  }

  toggleSunAnimation(): void {
    if (this.isSunAnimating) {
      this.stopSunAnimation();

      return;
    }

    this.isSunAnimating = true;
    this.sunAnimationTimer = setInterval(this.advanceSunAnimation, SUN_ANIMATION_INTERVAL_MS);
  }

  stopSunAnimation(): void {
    if (!isNil(this.sunAnimationTimer)) {
      clearInterval(this.sunAnimationTimer);
      this.sunAnimationTimer = undefined;
    }

    this.isSunAnimating = false;
  }

  /** The overlay segment of the toolbar; it colours the plan and the 3D view alike. */
  setOverlayMode(overlayMode: OverlayMode): void {
    this.overlayMode = overlayMode;
  }

  /** Switching tools abandons whatever the previous one had in flight. */
  setActiveTool(activeTool: ActiveTool): void {
    if (!isToolAllowed(this.editorMode, activeTool)) {
      return;
    }

    this.activeTool = activeTool;

    if (isPlanTool(activeTool) && isShapeTool(activeTool)) {
      this.armedShapeTool = activeTool;
    }

    this.draftShape = undefined;
    this.draftMark = undefined;
    this.activeKeyPointSnap = undefined;
    this.elevationInputMarkId = undefined;
    this.measurePoints = NO_MEASURE_POINTS;
    this.cancelDraftPath();
  }

  setSelection(selection: Selection | undefined): void {
    this.selection = selection;

    if (isNil(selection) || selection.kind !== 'path') {
      this.setSelectedPathPointIndex(undefined);
    }
  }

  /**
   * Opens one object for deep editing; see `modes.md`. The editor arrives with
   * a fresh session for its transient state; the tool falls back to selection
   * because whatever was armed may not exist in the new mode, and a path
   * target arrives selected — it is the only thing left to point at.
   */
  enterEditMode(target: EditTarget): void {
    this.editorSession?.dispose();
    this.editorSession = createEditorSession(target);
    this.editorMode = { kind: 'edit', target };
    this.setSelection(editedTargetSelection(target));
    this.setActiveTool('select');

    // Site editing opens aimed at the plot root; «Строение» re-aims it after.
    if (target.kind === 'site') {
      this.setActiveGroup('boundary');
    }
  }

  /**
   * Descends through a selected object's editor door (`editorDoorFor`): the
   * one entry Enter, the double click and the panels' «edit» buttons share. A
   * building door is site editing already aimed at that building.
   */
  openEditorDoor(door: EditorDoor): void {
    this.enterEditMode(door.target);

    if (!isNil(door.aimAt)) {
      this.setActiveGroup(door.aimAt);
    }
  }

  /**
   * Back to viewing. A shape or mark selection belongs to site editing and
   * would name something the view cannot even pick, so it is dropped; a path,
   * tree or car selection is a view-mode citizen and survives the exit.
   */
  exitEditMode(): void {
    this.editorSession?.dispose();
    this.editorSession = undefined;
    this.editorMode = VIEW_MODE;

    const { selection } = this;

    if (
      !isNil(selection) &&
      (selection.kind === 'shape' ||
        selection.kind === 'group' ||
        selection.kind === 'mark' ||
        selection.kind === 'wall' ||
        selection.kind === 'opening' ||
        selection.kind === 'furniture' ||
        selection.kind === 'device')
    ) {
      this.selection = undefined;
    }

    this.setActiveTool('select');
  }

  /** The path session's edited point, read through the store's one access point. */
  get selectedPathPointIndex(): number | undefined {
    return this.editorSession?.kind === 'path' ? this.editorSession.selectedPointIndex : undefined;
  }

  setSelectedPathPointIndex(index: number | undefined): void {
    if (this.editorSession?.kind === 'path') {
      this.editorSession.setSelectedPointIndex(index);
    }
  }

  get hoveredPathSegmentIndex(): number | undefined {
    return this.editorSession?.kind === 'path' ? this.editorSession.hoveredSegmentIndex : undefined;
  }

  setHoveredPathSegmentIndex(index: number | undefined): void {
    if (this.editorSession?.kind === 'path') {
      this.editorSession.setHoveredSegmentIndex(index);
    }
  }

  /**
   * The rail's «Строение» button: the house is drawn inside site editing, so
   * this opens that editor already aimed at it — new shapes land in the house
   * group and the drawing tool is in hand, one click from a footprint. From
   * inside site editing it only re-aims: the editor, the selection and the
   * undo trail all stay put.
   */
  enterBuildingEditing(defaultName: string): void {
    if (!isSiteEditMode(this.editorMode)) {
      this.enterEditMode({ kind: 'site' });
    }

    const [first] = this.buildings;

    if (isNil(first)) {
      // A plan with no structures yet: the button also mints the first one.
      this.addBuilding(defaultName);
    } else if (this.activeGroup.owner === 'boundary') {
      this.setActiveGroup(first.id);
    }

    this.setActiveTool(this.armedShapeTool);
  }

  /** Whether site editing is currently aimed at one of the buildings. */
  get isEditingBuilding(): boolean {
    return isSiteEditMode(this.editorMode) && this.activeGroup.owner !== 'boundary';
  }

  /** What the mode bar names as being edited, or nothing while viewing. */
  get editedObject(): EditedObjectDescriptor | undefined {
    return describeEditedObject(this.editorMode, {
      activeOwner: this.activeGroup.owner,
      buildings: this.buildings,
      paths: this.paths,
      utilityRoutes: this.utilityRoutes,
    });
  }

  setMeasurePoints(measurePoints: readonly Vector2[]): void {
    this.measurePoints = measurePoints;
  }

  /** Nothing for the group means the root term list of the owning composition. */
  setActiveGroup(owner: ShapeOwner, groupId?: ShapeId): void {
    this.activeGroup = { owner, groupId };
  }

  setDraftShape(draftShape: Shape | undefined): void {
    this.draftShape = draftShape;
  }

  setDraftMark(draftMark: ElevationMark | undefined): void {
    this.draftMark = draftMark;
  }

  setActiveKeyPointSnap(activeKeyPointSnap: KeyPointSnap | undefined): void {
    this.activeKeyPointSnap = activeKeyPointSnap;
  }

  /** Guarded against no-op writes: the pointer reports every move, the canvas need not redraw for each. */
  setPathHandleHighlight(highlight: PathHandleHighlight | undefined): void {
    if (!isEqual(this.pathHandleHighlight, highlight)) {
      this.pathHandleHighlight = highlight;
    }
  }

  setCursorPlanPoint(cursorPlanPoint: Vector2 | undefined): void {
    this.cursorPlanPoint = cursorPlanPoint;
  }

  setViewport(viewport: PlanViewport): void {
    this.viewport = viewport;
  }

  setCameraYawDegrees(cameraYawDegrees: number): void {
    this.cameraYawDegrees = cameraYawDegrees;
  }

  /** Asks the properties panel for the keyboard, once the panel is on screen. */
  requestPropertiesFocus(): void {
    this.isPropertiesFocusPending = true;
  }

  consumePropertiesFocus(): void {
    this.isPropertiesFocusPending = false;
  }

  /**
   * Places a mark and hands it straight to the user: it becomes the selection,
   * and the field by its flag opens so the surveyed elevation can be typed
   * without a trip to the properties panel.
   */
  addElevationMark(position: Vector2): ElevationMark {
    const mark = createElevationMark({ position, elevation: NEW_MARK_ELEVATION_METERS });

    this.pushHistory();
    this.elevationMarks = addMark(this.elevationMarks, mark);
    this.selection = { kind: 'mark', markId: mark.id };
    this.elevationInputMarkId = mark.id;

    return mark;
  }

  /** A pasted batch lands as one step: the paste is what the user would undo. */
  addElevationMarks(drafts: readonly ElevationMarkDraft[]): void {
    if (drafts.length === 0) {
      return;
    }

    this.pushHistory();
    this.elevationMarks = [...this.elevationMarks, ...drafts.map(createElevationMark)];
  }

  moveElevationMark(markId: MarkId, position: Vector2): void {
    this.elevationMarks = moveMark(this.elevationMarks, markId, position);
  }

  setElevationMarkElevation(markId: MarkId, elevation: Meters): void {
    this.elevationMarks = setMarkElevationIn(this.elevationMarks, markId, elevation);
  }

  removeElevationMark(markId: MarkId): void {
    this.pushHistory();
    this.elevationMarks = removeMark(this.elevationMarks, markId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'mark' && selection.markId === markId) {
      this.selection = undefined;
    }

    if (this.elevationInputMarkId === markId) {
      this.elevationInputMarkId = undefined;
    }
  }

  closeElevationInput(): void {
    this.elevationInputMarkId = undefined;
  }

  /** The flyout's choice: what the next click of the placing tool puts down. */
  setNextPlacedObject(nextPlacedObject: PlacedObject): void {
    this.nextPlacedObject = nextPlacedObject;
  }

  /** Puts whatever the catalogue has chosen on the plan, at the given point. */
  placeSelectedObject(position: Vector2): void {
    const object = this.nextPlacedObject;

    switch (object.kind) {
      case 'tree':
        this.plantTree(position, object.species);

        return;
      case 'car':
        this.placeCar(position);

        return;
      default:
        assertNever(object);
    }
  }

  /**
   * Plants a tree and hands it to the user selected, so its size can be typed
   * straight into the properties panel.
   */
  plantTree(position: Vector2, species: TreeSpecies): TreeInstance {
    const tree = createTree({ species, position, ...TREE_SPECIES_DEFAULT_SIZES[species] });

    this.pushHistory();
    this.trees = addTree(this.trees, tree);
    this.selection = { kind: 'tree', treeId: tree.id };

    return tree;
  }

  /**
   * Replaces a tree whole; the caller announces the history step it belongs to.
   * Touching a tree also arms the catalogue with its species: a row of the same
   * kind is planted by clicking, not by choosing before every click.
   */
  updateTree(tree: TreeInstance): void {
    this.nextPlacedObject = { kind: 'tree', species: tree.species };
    this.trees = replaceTreeIn(this.trees, tree);
  }

  removeTree(treeId: TreeId): void {
    this.pushHistory();
    this.trees = removeTreeFrom(this.trees, treeId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'tree' && selection.treeId === treeId) {
      this.selection = undefined;
    }
  }

  /** Parks a car facing plan east and hands it over selected, as a tree is planted. */
  placeCar(position: Vector2): CarInstance {
    const car = createCar({ position });

    this.pushHistory();
    this.cars = addCar(this.cars, car);
    this.selection = { kind: 'car', carId: car.id };

    return car;
  }

  /** Replaces a car whole; the caller announces the history step it belongs to. */
  updateCar(car: CarInstance): void {
    this.nextPlacedObject = CAR_PLACED_OBJECT;
    this.cars = replaceCarIn(this.cars, car);
  }

  removeCar(carId: CarId): void {
    this.pushHistory();
    this.cars = removeCarFrom(this.cars, carId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'car' && selection.carId === carId) {
      this.selection = undefined;
    }
  }

  /** Adds a point to the polyline being clicked out; the first one starts it. */
  appendDraftPathPoint(point: Vector2): void {
    this.draftPathPoints = [...this.draftPathPoints, point];
  }

  /**
   * Turns the polyline into a path, if it has a segment at all. The double click
   * that ends a line places its point first, so the repeated last point is
   * dropped rather than stored as a zero-length segment.
   */
  commitDraftPath(): void {
    const points = dropRepeatedPoints(this.draftPathPoints);

    this.draftPathPoints = NO_DRAFT_PATH_POINTS;

    if (points.length < MIN_PATH_POINT_COUNT) {
      return;
    }

    const path = createSitePath({ points, width: DEFAULT_PATH_WIDTH_METERS });

    this.pushHistory();
    this.paths = addPath(this.paths, path);
    this.selection = { kind: 'path', pathId: path.id };
  }

  cancelDraftPath(): void {
    this.draftPathPoints = NO_DRAFT_PATH_POINTS;
  }

  setPathWidth(pathId: PathId, width: Meters): void {
    this.paths = updatePathWidthIn(this.paths, pathId, width);
  }

  /** Replaces a building's whole footprint — a drag in flight, or its restore. */
  setBuildingComposition(buildingId: BuildingId, composition: ShapeComposition): void {
    this.buildings = updateBuildingIn(this.buildings, buildingId, { composition });
  }

  /** Replaces a path whole — the restore half of an interrupted point drag. */
  updatePath(path: SitePath): void {
    this.paths = updatePathIn(this.paths, path);
  }

  /**
   * Writes one view-mode object back whole, whatever its kind — the single
   * store door the unified object drag commits and restores through. The
   * caller announces the history step it belongs to.
   */
  applySiteObject(object: SiteObjectState): void {
    switch (object.kind) {
      case 'tree':
        this.updateTree(object.tree);

        return;
      case 'car':
        this.updateCar(object.car);

        return;
      case 'building':
        // A moved slab carries its interior, so the building lands whole.
        this.buildings = replaceBuildingIn(this.buildings, object.building);

        return;
      case 'path':
        this.updatePath(object.path);

        return;
      case 'utilityRoute':
        this.updateUtilityRoute(object.route);

        return;
      default:
        assertNever(object);
    }
  }

  movePathPoint(pathId: PathId, pointIndex: number, point: Vector2): void {
    this.paths = movePathPointIn(this.paths, pathId, pointIndex, point);
  }

  insertPathPoint(pathId: PathId, segmentIndex: number, point: Vector2): void {
    this.paths = insertPathPointIn(this.paths, pathId, segmentIndex, point);
  }

  /** Refuses silently below two points; the caller announces the history step. */
  removePathPoint(pathId: PathId, pointIndex: number): void {
    const before = this.paths;

    this.paths = removePathPointIn(this.paths, pathId, pointIndex);

    if (this.paths !== before && this.selectedPathPointIndex === pointIndex) {
      this.setSelectedPathPointIndex(undefined);
    }
  }

  setPathPointWidth(pathId: PathId, pointIndex: number, width: Meters): void {
    this.paths = setPathPointWidthIn(this.paths, pathId, pointIndex, width);
  }

  setPathSegmentSurface(pathId: PathId, segmentIndex: number, surface: PathSurface): void {
    this.pushHistory();
    this.paths = setPathSegmentSurfaceIn(this.paths, pathId, segmentIndex, surface);
  }

  removePath(pathId: PathId): void {
    this.pushHistory();
    this.paths = removePathFrom(this.paths, pathId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'path' && selection.pathId === pathId) {
      this.selection = undefined;
    }
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

    if (points.length < MIN_PATH_POINT_COUNT) {
      return;
    }

    const route = createUtilityRoute({ system: this.nextUtilitySystem, points });

    this.pushHistory();
    this.utilityRoutes = addUtilityRouteIn(this.utilityRoutes, route);
    this.selection = { kind: 'utilityRoute', routeId: route.id };
  }

  cancelDraftUtilityRoute(): void {
    this.draftUtilityPoints = NO_DRAFT_UTILITY_POINTS;
  }

  /** Replaces a trench whole — the restore half of an interrupted drag. */
  updateUtilityRoute(route: UtilityRoute): void {
    this.utilityRoutes = updateUtilityRouteIn(this.utilityRoutes, route);
  }

  moveUtilityRoutePoint(routeId: UtilityRouteId, pointIndex: number, point: Vector2): void {
    this.utilityRoutes = moveUtilityRoutePointIn(this.utilityRoutes, routeId, pointIndex, point);
  }

  insertUtilityRoutePoint(routeId: UtilityRouteId, segmentIndex: number, point: Vector2): void {
    this.utilityRoutes = insertUtilityRoutePointIn(
      this.utilityRoutes,
      routeId,
      segmentIndex,
      point
    );
  }

  /** Refuses silently below a segment's worth; the caller announced the step. */
  removeUtilityRoutePoint(routeId: UtilityRouteId, pointIndex: number): void {
    this.utilityRoutes = removeUtilityRoutePointIn(this.utilityRoutes, routeId, pointIndex);
  }

  /**
   * Re-labels a trench with another system. The bore follows the system the
   * way a tree's size follows its species: a sewer gains the standard pipe,
   * anything else stops carrying one.
   */
  setUtilityRouteSystem(routeId: UtilityRouteId, system: UtilitySystem): void {
    const route = this.utilityRoutes.find(candidate => candidate.id === routeId);

    if (isNil(route) || route.system === system) {
      return;
    }

    this.pushHistory();
    this.utilityRoutes = updateUtilityRouteIn(this.utilityRoutes, {
      ...route,
      system,
      diameterMeters: system === 'sewer' ? DEFAULT_SEWER_DIAMETER_METERS : undefined,
    });
  }

  setUtilityRouteDiameter(routeId: UtilityRouteId, diameterMeters: Meters): void {
    const route = this.utilityRoutes.find(candidate => candidate.id === routeId);

    if (isNil(route)) {
      return;
    }

    this.pushHistory(`${ROUTE_HISTORY_GROUP}:${routeId}`);
    this.utilityRoutes = updateUtilityRouteIn(this.utilityRoutes, { ...route, diameterMeters });
  }

  removeUtilityRoute(routeId: UtilityRouteId): void {
    // The СЕТИ panel offers removal inside the trench editor too, and an
    // editor must not stay open on an object that no longer exists.
    if (
      this.editorMode.kind === 'edit' &&
      this.editorMode.target.kind === 'utilityRoute' &&
      this.editorMode.target.routeId === routeId
    ) {
      this.exitEditMode();
    }

    this.pushHistory();
    this.utilityRoutes = removeUtilityRouteFrom(this.utilityRoutes, routeId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'utilityRoute' && selection.routeId === routeId) {
      this.selection = undefined;
    }
  }

  /**
   * The nearest entry of one system within reach — what a trench click snaps
   * onto and a dragged bend lands on, so the site run and the indoor run
   * actually meet at the seam the entry is (`building-editor.md` §3).
   */
  nearestEntryPoint(
    planPoint: Vector2,
    withinMeters: Meters,
    system: UtilitySystem
  ): Vector2 | undefined {
    let nearest: Vector2 | undefined;
    let nearestDistance = withinMeters;

    for (const scene of this.buildingScenes) {
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

  /**
   * Appends a term to the named group, or to the root of the composition when no
   * group is named. The first shape drawn into the house also creates the
   * footprint — which has no groups yet, so that term can only land at its root.
   */
  addShapeTerm(owner: ShapeOwner, shape: Shape, operation: CsgOperation, groupId?: ShapeId): void {
    const term: CsgTerm = { operand: shape, operation };

    this.pushHistory();
    this.updateComposition(owner, composition => addTerm(composition, term, groupId));
  }

  updateShape(owner: ShapeOwner, shape: Shape): void {
    this.updateComposition(owner, composition => replaceShapeIn(composition, shape));
  }

  /** The keyboard path of R20: the properties panel edits whatever is selected. */
  updateSelectedShape(shape: Shape): void {
    const { selection } = this;

    if (isNil(selection) || selection.kind !== 'shape') {
      return;
    }

    this.updateShape(selection.owner, shape);
  }

  /**
   * Switching to the manual mode carries over whatever the terrain modes were
   * giving, so the field opens on the number the user has just been looking at
   * rather than on the site datum.
   */
  setPadElevationMode(buildingId: BuildingId, padElevationMode: PadElevationMode): void {
    const building = findBuildingIn(this.buildings, buildingId);
    const scene = this.buildingScenes.find(candidate => candidate.building.id === buildingId);

    if (isNil(building)) {
      return;
    }

    this.pushHistory();
    this.buildings = updateBuildingIn(this.buildings, buildingId, {
      padElevationMode,
      manualPadElevation:
        padElevationMode === 'manual'
          ? (building.manualPadElevation ?? scene?.padElevation)
          : building.manualPadElevation,
    });
  }

  setManualPadElevation(buildingId: BuildingId, manualPadElevation: Meters): void {
    this.pushHistory(`${MANUAL_PAD_HISTORY_GROUP}:${buildingId}`);
    this.buildings = updateBuildingIn(this.buildings, buildingId, { manualPadElevation });
  }

  setWallHeight(buildingId: BuildingId, wallHeight: Meters): void {
    this.pushHistory(`${WALL_HEIGHT_HISTORY_GROUP}:${buildingId}`);
    this.buildings = updateBuildingIn(this.buildings, buildingId, { wallHeight });
  }

  /**
   * Edits a building's foundation field by field. Typed numbers group per
   * building, so a burst of keystrokes stays one step to undo.
   */
  updateFoundation(buildingId: BuildingId, changes: Partial<Foundation>): void {
    this.pushHistory(`${FOUNDATION_HISTORY_GROUP}:${buildingId}`);
    this.buildings = updateFoundationIn(this.buildings, buildingId, changes);
  }

  /**
   * Adds one system's entry with its norm defaults (`createUtilityEntry`),
   * landing it a step further along the outline than the last one.
   */
  addUtilityEntry(buildingId: BuildingId, system: UtilitySystem): void {
    const building = findBuildingIn(this.buildings, buildingId);

    if (isNil(building)) {
      return;
    }

    this.pushHistory();
    this.buildings = addUtilityEntryIn(
      this.buildings,
      buildingId,
      createUtilityEntry({
        system,
        outlineOffsetMeters: entriesOf(building).length * ENTRY_SPACING_METERS,
        frostDepthMeters: this.frostDepthMeters,
      })
    );
  }

  updateUtilityEntry(
    buildingId: BuildingId,
    entryId: UtilityEntryId,
    changes: Partial<Omit<UtilityEntry, 'id' | 'system'>>
  ): void {
    this.pushHistory(`${ENTRY_HISTORY_GROUP}:${entryId}`);
    this.buildings = updateUtilityEntryIn(this.buildings, buildingId, entryId, changes);
  }

  removeUtilityEntry(buildingId: BuildingId, entryId: UtilityEntryId): void {
    this.pushHistory();
    this.buildings = removeUtilityEntryFrom(this.buildings, buildingId, entryId);
  }

  /** The wall the selection names, when it still exists. */
  get selectedWall(): Wall | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'wall'
      ? undefined
      : findWallIn(this.buildings, selection.buildingId, selection.wallId);
  }

  /** The polyline of the wall being clicked out inside the building editor. */
  get draftWallPoints(): readonly Vector2[] {
    return this.editorSession?.kind === 'building' ? this.editorSession.draftWallPoints : [];
  }

  appendDraftWallPoint(point: Vector2): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.appendDraftWallPoint(point);
    }
  }

  cancelDraftWall(): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.clearDraftWall();
    }
  }

  /**
   * Turns the clicked-out polyline into a wall of the default construction —
   * one step to undo — and hands it over selected, its numbers one typed
   * change away in the panel.
   */
  commitDraftWall(): void {
    const session = this.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    const drawnPoints = dropRepeatedPoints(session.draftWallPoints);

    session.clearDraftWall();

    if (drawnPoints.length < MIN_WALL_POINTS) {
      return;
    }

    const building = findBuildingIn(this.buildings, session.buildingId);
    const storeyId =
      this.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);

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

    this.pushHistory();
    this.buildings = addWallIn(this.buildings, session.buildingId, storeyId, wall);
    this.setSelection({ kind: 'wall', buildingId: session.buildingId, wallId: wall.id });
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
    this.pushHistory(`${WALL_HISTORY_GROUP}:${wallId}`);
    this.buildings = updateWallIn(this.buildings, buildingId, wallId, changes);
  }

  /**
   * The point held onto the foundation slab: itself while it stands on the
   * footprint, the nearest spot of the slab's edge otherwise — walls are not
   * drawn or dragged past what carries them (a building with no footprint yet
   * constrains nothing).
   */
  clampToFoundation(buildingId: BuildingId, point: Vector2): Vector2 {
    const scene = this.buildingScenes.find(candidate => candidate.building.id === buildingId);

    return isNil(scene) ? point : clampPointToMultiPolygon(scene.polygons, point);
  }

  /** Replaces one drawn point; the caller announces the history step it belongs to. */
  moveWallPoint(buildingId: BuildingId, wallId: WallId, pointIndex: number, point: Vector2): void {
    this.buildings = moveWallPointIn(this.buildings, buildingId, wallId, pointIndex, point);
  }

  /** Plants a corner in a segment; the caller announces the history step. */
  insertWallPoint(
    buildingId: BuildingId,
    wallId: WallId,
    segmentIndex: number,
    point: Vector2
  ): void {
    this.buildings = insertWallPointIn(this.buildings, buildingId, wallId, segmentIndex, point);
  }

  /** Refuses silently at the wall's floor; the caller announced the step. */
  removeWallPoint(buildingId: BuildingId, wallId: WallId, pointIndex: number): void {
    this.buildings = removeWallPointIn(this.buildings, buildingId, wallId, pointIndex);
  }

  /** Closes the wall into a ring — the endpoint gesture and the panel button alike. */
  closeWallRing(buildingId: BuildingId, wallId: WallId): void {
    this.pushHistory();
    this.buildings = closeWallRingIn(this.buildings, buildingId, wallId);
  }

  /** Cuts the wall at a corner: a ring opens there, an open wall splits in two. */
  cutWallAtPoint(buildingId: BuildingId, wallId: WallId, pointIndex: number): void {
    this.buildings = cutWallAtPointIn(this.buildings, buildingId, wallId, pointIndex);
  }

  /** Replaces a wall whole — the restore half of an interrupted point drag. */
  restoreWall(buildingId: BuildingId, wall: Wall): void {
    this.buildings = updateWallIn(this.buildings, buildingId, wall.id, wall);
  }

  removeWall(buildingId: BuildingId, wallId: WallId): void {
    this.pushHistory();
    this.buildings = removeWallFrom(this.buildings, buildingId, wallId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'wall' && selection.wallId === wallId) {
      this.selection = undefined;
    }
  }

  /** The opening the selection names, when it still exists. */
  get selectedOpening(): Opening | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'opening'
      ? undefined
      : findOpeningIn(this.buildings, selection.buildingId, selection.openingId);
  }

  /** What the opening tool places next; door until the editor arms another. */
  get armedOpeningPreset(): OpeningPreset {
    return this.editorSession?.kind === 'building'
      ? this.editorSession.armedOpeningPreset
      : DEFAULT_OPENING_PRESET;
  }

  setArmedOpeningPreset(preset: OpeningPreset): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.setArmedOpeningPreset(preset);
    }
  }

  /**
   * Hangs the armed preset's opening onto the wall at that offset — one step
   * to undo — and hands it over selected.
   */
  addOpeningAt(buildingId: BuildingId, wallId: WallId, offsetMeters: Meters): void {
    const opening = createOpening({ wallId, preset: this.armedOpeningPreset, offsetMeters });

    this.pushHistory();
    this.buildings = addOpeningIn(this.buildings, buildingId, opening);
    this.setSelection({ kind: 'opening', buildingId, openingId: opening.id });
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
    this.pushHistory(`${OPENING_HISTORY_GROUP}:${openingId}`);
    this.buildings = updateOpeningIn(this.buildings, buildingId, openingId, changes);
  }

  /** Slides the opening along its wall; the caller announces the history step. */
  moveOpening(buildingId: BuildingId, openingId: OpeningId, offsetMeters: Meters): void {
    this.buildings = updateOpeningIn(this.buildings, buildingId, openingId, { offsetMeters });
  }

  removeOpening(buildingId: BuildingId, openingId: OpeningId): void {
    this.pushHistory();
    this.buildings = removeOpeningFrom(this.buildings, buildingId, openingId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'opening' && selection.openingId === openingId) {
      this.selection = undefined;
    }
  }

  /**
   * Assigns — or clears — a derived room's type by pinning a label to a seed
   * point inside the region (`building-editor.md` §4): the room itself is
   * never stored, so whichever region holds the point wears the type.
   */
  setRoomType(
    buildingId: BuildingId,
    room: BuildingRoom,
    roomTypeId: RoomTypeId | undefined
  ): void {
    this.pushHistory();

    if (isNil(roomTypeId)) {
      if (!isNil(room.labelId)) {
        this.buildings = removeRoomLabelFrom(this.buildings, buildingId, room.labelId);
      }

      return;
    }

    const position = seedPointOf(room.polygons, room.centroid);

    if (isNil(position)) {
      return;
    }

    const label = isNil(room.labelId)
      ? createRoomLabel({ position, roomTypeId })
      : { id: room.labelId, position, roomTypeId };

    this.buildings = upsertRoomLabelIn(this.buildings, buildingId, room.storeyId, label);
  }

  /**
   * Pins — or clears — a roof zone's cover by its seed point, exactly the way
   * a room's type is pinned. Membrane is the default, so choosing it back
   * simply removes the label.
   */
  setRoofCover(buildingId: BuildingId, zone: RoofZoneScene, cover: RoofCover): void {
    this.pushHistory();

    if (cover === DEFAULT_ROOF_COVER) {
      if (!isNil(zone.labelId)) {
        this.buildings = removeRoofZoneLabelFrom(this.buildings, buildingId, zone.labelId);
      }

      return;
    }

    const position = seedPointOf(zone.polygons, zone.centroid);

    if (isNil(position)) {
      return;
    }

    const label = isNil(zone.labelId)
      ? createRoofZoneLabel({ position, cover })
      : { id: zone.labelId, position, cover };

    this.buildings = upsertRoofZoneLabelIn(this.buildings, buildingId, zone.storeyId, label);
  }

  /** The furniture the selection names, when it still exists. */
  get selectedFurniture(): FurnitureInstance | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'furniture'
      ? undefined
      : findFurnitureIn(this.buildings, selection.buildingId, selection.furnitureId);
  }

  /** What the furniture tool places next, chosen in the МЕБЕЛЬ panel. */
  get armedFurnitureId(): FurnitureCatalogId {
    return this.editorSession?.kind === 'building'
      ? this.editorSession.armedFurnitureId
      : DEFAULT_FURNITURE_CATALOG_ID;
  }

  setArmedFurnitureId(catalogId: FurnitureCatalogId): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.setArmedFurnitureId(catalogId);
    }
  }

  /** Places the armed piece on the active storey — one step to undo, selected. */
  placeFurnitureAt(buildingId: BuildingId, position: Vector2): void {
    const building = findBuildingIn(this.buildings, buildingId);
    const storeyId =
      this.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);

    if (isNil(storeyId)) {
      return;
    }

    const furniture = createFurniture({ catalogId: this.armedFurnitureId, position });

    this.pushHistory();
    this.buildings = addFurnitureIn(this.buildings, buildingId, storeyId, furniture);
    this.setSelection({ kind: 'furniture', buildingId, furnitureId: furniture.id });
  }

  /**
   * Edits a piece field by field. Typed numbers group per piece, so a burst
   * of keystrokes stays one step to undo.
   */
  updateFurnitureProperties(
    buildingId: BuildingId,
    furnitureId: FurnitureId,
    changes: Partial<Omit<FurnitureInstance, 'id' | 'catalogId'>>
  ): void {
    this.pushHistory(`${FURNITURE_HISTORY_GROUP}:${furnitureId}`);
    this.buildings = updateFurnitureIn(this.buildings, buildingId, furnitureId, changes);
  }

  /** Follows the pointer; the caller announces the history step it belongs to. */
  moveFurniture(
    buildingId: BuildingId,
    furnitureId: FurnitureId,
    changes: Partial<Omit<FurnitureInstance, 'id' | 'catalogId'>>
  ): void {
    this.buildings = updateFurnitureIn(this.buildings, buildingId, furnitureId, changes);
  }

  removeFurniture(buildingId: BuildingId, furnitureId: FurnitureId): void {
    this.pushHistory();
    this.buildings = removeFurnitureFrom(this.buildings, buildingId, furnitureId);

    const { selection } = this;

    if (
      !isNil(selection) &&
      selection.kind === 'furniture' &&
      selection.furnitureId === furnitureId
    ) {
      this.selection = undefined;
    }
  }

  /** The device the selection names, when it still exists. */
  get selectedDevice(): ElectricalDevice | undefined {
    const { selection } = this;

    return isNil(selection) || selection.kind !== 'device'
      ? undefined
      : findDeviceIn(this.buildings, selection.buildingId, selection.deviceId);
  }

  /** What the electric tool places next. */
  get armedDeviceKind(): DeviceKind {
    return this.editorSession?.kind === 'building'
      ? this.editorSession.armedDeviceKind
      : DEFAULT_DEVICE_KIND;
  }

  setArmedDeviceKind(kind: DeviceKind): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.setArmedDeviceKind(kind);
    }
  }

  /** The first half of a connect gesture, echoed by the panel and the plan. */
  get pendingConnectDeviceId(): DeviceId | undefined {
    return this.editorSession?.kind === 'building'
      ? this.editorSession.pendingConnectDeviceId
      : undefined;
  }

  setPendingConnectDeviceId(deviceId: DeviceId | undefined): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.setPendingConnectDeviceId(deviceId);
    }
  }

  /** Hangs a wall device at its conventional height — one step to undo, selected. */
  addWallDeviceAt(
    buildingId: BuildingId,
    kind: Exclude<DeviceKind, 'light'>,
    wallId: WallId,
    offsetMeters: Meters
  ): void {
    const device = createWallDevice({ kind, wallId, offsetMeters });
    const storeyId = this.resolveActiveStoreyId(buildingId);

    if (isNil(storeyId)) {
      return;
    }

    this.pushHistory();
    this.buildings = addDeviceIn(this.buildings, buildingId, storeyId, device);
    this.setSelection({ kind: 'device', buildingId, deviceId: device.id });
  }

  /** Puts a light on the ceiling of the active storey — one step, selected. */
  addCeilingLightAt(buildingId: BuildingId, position: Vector2): void {
    const device = createCeilingLight(position);
    const storeyId = this.resolveActiveStoreyId(buildingId);

    if (isNil(storeyId)) {
      return;
    }

    this.pushHistory();
    this.buildings = addDeviceIn(this.buildings, buildingId, storeyId, device);
    this.setSelection({ kind: 'device', buildingId, deviceId: device.id });
  }

  /**
   * Edits a device field by field. Typed numbers group per device, so a burst
   * of keystrokes stays one step to undo.
   */
  updateDeviceProperties(
    buildingId: BuildingId,
    deviceId: DeviceId,
    changes: Partial<Omit<ElectricalDevice, 'id' | 'kind'>>
  ): void {
    this.pushHistory(`${DEVICE_HISTORY_GROUP}:${deviceId}`);
    this.buildings = updateDeviceIn(this.buildings, buildingId, deviceId, changes);
  }

  /** Follows the pointer; the caller announces the history step it belongs to. */
  moveDevice(
    buildingId: BuildingId,
    deviceId: DeviceId,
    changes: Partial<Omit<ElectricalDevice, 'id' | 'kind'>>
  ): void {
    this.buildings = updateDeviceIn(this.buildings, buildingId, deviceId, changes);
  }

  removeDevice(buildingId: BuildingId, deviceId: DeviceId): void {
    this.pushHistory();
    this.buildings = removeDeviceFrom(this.buildings, buildingId, deviceId);

    const { selection } = this;

    if (!isNil(selection) && selection.kind === 'device' && selection.deviceId === deviceId) {
      this.selection = undefined;
    }
  }

  /**
   * The connect tool's second click: panel + consumer joins the группа,
   * switch + light ties the link — whichever order the two were clicked in.
   */
  connectDevices(buildingId: BuildingId, firstId: DeviceId, secondId: DeviceId): void {
    const first = findDeviceIn(this.buildings, buildingId, firstId);
    const second = findDeviceIn(this.buildings, buildingId, secondId);

    if (isNil(first) || isNil(second) || firstId === secondId) {
      return;
    }

    if (first.kind === 'panel' || second.kind === 'panel') {
      const [panel, consumer] = first.kind === 'panel' ? [first, second] : [second, first];

      if (consumer.kind === 'panel') {
        return;
      }

      this.pushHistory();
      this.buildings = assignDeviceToPanelIn(this.buildings, buildingId, panel.id, consumer.id);

      return;
    }

    const kinds = new Set([first.kind, second.kind]);

    if (kinds.has('switch') && kinds.has('light')) {
      const switchId = first.kind === 'switch' ? first.id : second.id;
      const lightId = first.kind === 'light' ? first.id : second.id;

      this.pushHistory();
      this.buildings = linkSwitchToLightIn(this.buildings, buildingId, switchId, lightId);
    }
  }

  /** The active storey, or the ground one while nothing narrower is aimed at. */
  private resolveActiveStoreyId(buildingId: BuildingId): StoreyId | undefined {
    const building = findBuildingIn(this.buildings, buildingId);

    return this.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);
  }

  /** The storey the building editor is aimed at; the ground one by default. */
  /** The КОМНАТЫ row under the pointer, read through the store's one access point. */
  get hoveredRoomIndex(): number | undefined {
    return this.editorSession?.kind === 'building'
      ? this.editorSession.hoveredRoomIndex
      : undefined;
  }

  setHoveredRoomIndex(index: number | undefined): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.setHoveredRoomIndex(index);
    }
  }

  get activeStoreyId(): StoreyId | undefined {
    const session = this.editorSession;

    if (session?.kind !== 'building') {
      return undefined;
    }

    if (!isNil(session.activeStoreyId)) {
      return session.activeStoreyId;
    }

    const building = findBuildingIn(this.buildings, session.buildingId);

    return isNil(building) ? undefined : storeysOf(building)[0].id;
  }

  setActiveStorey(storeyId: StoreyId): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.setActiveStoreyId(storeyId);
      this.setSelection(undefined);
    }
  }

  /** The edited building's active storey, resolved against the scenes. */
  get editedStoreyScene(): StoreyScene | undefined {
    const session = this.editorSession;

    if (session?.kind !== 'building') {
      return undefined;
    }

    const scene = this.buildingScenes.find(
      candidate => candidate.building.id === session.buildingId
    );

    return scene?.storeys.find(storeyScene => storeyScene.storey.id === this.activeStoreyId);
  }

  get isReferenceStoreyVisible(): boolean {
    return this.editorSession?.kind === 'building'
      ? this.editorSession.isReferenceStoreyVisible
      : false;
  }

  toggleReferenceStorey(): void {
    if (this.editorSession?.kind === 'building') {
      this.editorSession.toggleReferenceStorey();
    }
  }

  /**
   * Raises one more storey over the edited building — empty, or starting from
   * a copy of the storey below's walls (new identities, openings left behind)
   * — and aims the editor at it (`building-editor.md` §5).
   */
  addStoreyToEditedBuilding({ copyWalls }: { readonly copyWalls: boolean }): void {
    const session = this.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    const building = findBuildingIn(this.buildings, session.buildingId);

    if (isNil(building)) {
      return;
    }

    const below = storeysOf(building)[storeysOf(building).length - 1];
    const storey = createStorey({
      heightMeters: DEFAULT_UPPER_STOREY_HEIGHT_METERS,
      walls: copyWalls
        ? below.walls.map(wall => ({ ...wall, id: crypto.randomUUID() as Wall['id'] }))
        : [],
    });

    this.pushHistory();
    this.buildings = addStoreyIn(this.buildings, session.buildingId, storey);
    this.setActiveStorey(storey.id);
  }

  /** Takes an upper storey down; the ground one is refused by the domain edit. */
  removeStoreyFromEdited(storeyId: StoreyId): void {
    const session = this.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    this.pushHistory();
    this.buildings = removeStoreyFrom(this.buildings, session.buildingId, storeyId);

    const building = findBuildingIn(this.buildings, session.buildingId);

    if (!isNil(building) && this.activeStoreyId === storeyId) {
      this.setActiveStorey(storeysOf(building)[0].id);
    }
  }

  /** Mints a named structure and aims the editor at it, ready to draw. */
  addBuilding(name: string, presetId?: BuildingPresetId): Building {
    const preset = isNil(presetId) ? undefined : findBuildingPreset(presetId);
    const created = createBuilding({ name });
    // A preset only seeds the data — a carport starts on piers with a lower
    // roof, a shed lower still — and everything stays editable afterwards.
    const building = isNil(preset)
      ? created
      : {
          ...created,
          wallHeight: preset.wallHeightMeters,
          foundation: { ...foundationOf(created), kind: preset.foundationKind },
        };

    this.pushHistory();
    this.buildings = addBuildingIn(this.buildings, building);
    this.setActiveGroup(building.id);

    return building;
  }

  renameBuilding(buildingId: BuildingId, name: string): void {
    this.pushHistory(`building:${buildingId}:name`);
    this.buildings = updateBuildingIn(this.buildings, buildingId, { name });
  }

  removeBuilding(buildingId: BuildingId): void {
    this.pushHistory();
    this.buildings = removeBuildingIn(this.buildings, buildingId);

    const { selection, activeGroup } = this;

    if (
      !isNil(selection) &&
      ((selection.kind === 'building' && selection.buildingId === buildingId) ||
        ((selection.kind === 'shape' || selection.kind === 'group') &&
          selection.owner === buildingId))
    ) {
      this.selection = undefined;
    }

    if (activeGroup.owner === buildingId) {
      this.setActiveGroup('boundary');
    }
  }

  toggleTermOperation(owner: ShapeOwner, operandId: ShapeId): void {
    this.pushHistory();
    this.updateComposition(owner, composition => {
      const term = findTerm(composition, operandId);

      if (isNil(term)) {
        return composition;
      }

      return setTermOperationIn(
        composition,
        operandId,
        term.operation === 'union' ? 'subtract' : 'union'
      );
    });
  }

  reorderTerm(owner: ShapeOwner, operandId: ShapeId, targetIndex: number): void {
    this.pushHistory();
    this.updateComposition(owner, composition =>
      reorderTermIn(composition, operandId, targetIndex)
    );
  }

  /**
   * Drags a term to another place in the tree: into the named group, or into the
   * root of its composition when none is named. The edit is run before the step
   * is announced — a drop that changes nothing (onto its own place, or into the
   * term's own subtree) must not cost the user an empty undo.
   */
  moveTerm(
    owner: ShapeOwner,
    operandId: ShapeId,
    targetGroupId: ShapeId | undefined,
    targetIndex: number
  ): void {
    const composition = resolveComposition(owner, this.boundary, this.buildings);

    if (isNil(composition)) {
      return;
    }

    const moved = moveTermIn(composition, operandId, targetGroupId, targetIndex);

    if (moved === composition) {
      return;
    }

    this.pushHistory();
    this.updateComposition(owner, () => moved);
  }

  /**
   * Puts the term into a group of its own. The new group is handed straight to
   * the user — selected, and active — so the next shape drawn lands inside it,
   * which is the whole reason for wrapping a term in the first place.
   */
  wrapTermInGroup(owner: ShapeOwner, operandId: ShapeId): void {
    const groupId = createShapeId();

    this.pushHistory();
    this.updateComposition(owner, composition =>
      wrapTermInGroupIn(composition, operandId, groupId)
    );

    const composition = resolveComposition(owner, this.boundary, this.buildings);

    if (!isNil(composition) && !isNil(findGroupTerm(composition, groupId))) {
      this.selection = { kind: 'group', owner, groupId };
      this.activeGroup = { owner, groupId };
    }
  }

  /** Inlines the terms of the group in its place; the group itself ceases to be. */
  ungroupTerm(owner: ShapeOwner, groupId: ShapeId): void {
    this.pushHistory();
    this.updateComposition(owner, composition => ungroupTermIn(composition, groupId));
    this.dropSelectionOf(owner, groupId);
  }

  removeTerm(owner: ShapeOwner, operandId: ShapeId): void {
    this.pushHistory();
    this.updateComposition(owner, composition => removeTermFrom(composition, operandId));
    this.dropSelectionOf(owner, operandId);
  }

  removeSelected(): void {
    const { selection } = this;

    if (isNil(selection)) {
      return;
    }

    switch (selection.kind) {
      case 'shape':
        this.removeTerm(selection.owner, selection.shapeId);

        return;
      case 'group':
        this.removeTerm(selection.owner, selection.groupId);

        return;
      case 'mark':
        this.removeElevationMark(selection.markId);

        return;
      case 'tree':
        this.removeTree(selection.treeId);

        return;
      case 'car':
        this.removeCar(selection.carId);

        return;
      case 'path':
        this.removePath(selection.pathId);

        return;
      case 'utilityRoute':
        this.removeUtilityRoute(selection.routeId);

        return;
      case 'building':
        this.removeBuilding(selection.buildingId);

        return;
      case 'wall':
        this.removeWall(selection.buildingId, selection.wallId);

        return;
      case 'opening':
        this.removeOpening(selection.buildingId, selection.openingId);

        return;
      case 'furniture':
        this.removeFurniture(selection.buildingId, selection.furnitureId);

        return;
      case 'device':
        this.removeDevice(selection.buildingId, selection.deviceId);

        return;
      default:
        assertNever(selection);
    }
  }

  /** Teardown hook honoured by the refcounted feature-store lifecycle. */
  dispose(): void {
    this.isDisposed = true;
    this.editorSession?.dispose();
    this.editorSession = undefined;
    this.stopSunAnimation();
    this.disposeHistoryCommit();
    this.disposeAutosave?.();
    this.disposeAutosave = undefined;
  }

  /** Drops the selection when the operand it named has just left the plan. */
  private dropSelectionOf(owner: ShapeOwner, operandId: ShapeId): void {
    const selected = selectedOperand(this.selection);

    if (!isNil(selected) && selected.owner === owner && selected.operandId === operandId) {
      this.selection = undefined;
    }
  }

  /**
   * One tick of the day animation: the sun moves on, and the sunset sends it
   * back to the sunrise so the day plays as a loop.
   */
  private advanceSunAnimation(): void {
    const { sunDayWindow, sunTimeMinutes } = this;
    const nextTimeMinutes = sunTimeMinutes + SUN_ANIMATION_STEP_MINUTES;

    this.sunTimeOverrideMinutes =
      nextTimeMinutes > sunDayWindow.sunsetMinutes ? sunDayWindow.sunriseMinutes : nextTimeMinutes;
  }

  /**
   * Turns the announced state into a step, now that the plan has moved off it.
   * Driven by the plan itself rather than by the callers: a stream of edits —
   * a drag, a burst of keystrokes — announces once and lands one step, and an
   * announcement no edit followed simply expires.
   */
  private commitPendingHistory(): void {
    const pendingPlan = this.pendingHistoryPlan;

    if (isNil(pendingPlan)) {
      return;
    }

    this.pendingHistoryPlan = undefined;
    this.history.push(pendingPlan);
    this.syncHistoryAvailability();
  }

  /**
   * Reads the persisted plan and only then starts watching for changes: a plan
   * loaded from storage is not an edit, and must not be written straight back.
   */
  private async initialize(): Promise<void> {
    const plan = await this.repository.loadPlan();

    // The route may already have been left while the read was in flight; a
    // reaction started now would outlive the store that owns it.
    if (this.isDisposed) {
      return;
    }

    runInAction(() => {
      if (!isNil(plan)) {
        this.applySnapshot(plan);
      }

      this.disposeAutosave = reaction(
        () => this.snapshot,
        nextPlan => {
          void this.persistPlan(nextPlan);
        },
        { delay: AUTOSAVE_DELAY_MS }
      );
    });
  }

  private async persistPlan(plan: SitePlan): Promise<void> {
    this.saveRequestId += 1;

    const requestId = this.saveRequestId;

    this.saveState = 'saving';

    try {
      await this.repository.savePlan(plan);
      this.settleSave(requestId, 'saved');
    } catch {
      this.settleSave(requestId, 'error');
    }
  }

  /** A save another one has already overtaken must not report its own outcome. */
  private settleSave(requestId: number, saveState: SitePlanSaveState): void {
    if (requestId === this.saveRequestId) {
      this.saveState = saveState;
    }
  }

  private reportSaveFailure(): void {
    this.saveState = 'error';
  }

  private restore(plan: SitePlan | undefined): void {
    if (isNil(plan)) {
      return;
    }

    this.applySnapshot(plan);
    // The selection survives — undoing a typed dimension must leave the shape
    // it was typed for in the properties panel. A selection the restored plan no
    // longer holds resolves to nothing through `selectedShape` anyway.
    this.clearGestureState();
    this.syncHistoryAvailability();
  }

  /** Drops every half-finished gesture; a plan that arrives whole invalidates them. */
  private clearGestureState(): void {
    this.draftShape = undefined;
    this.draftMark = undefined;
    this.activeKeyPointSnap = undefined;
    this.draftPathPoints = NO_DRAFT_PATH_POINTS;
    this.draftUtilityPoints = NO_DRAFT_UTILITY_POINTS;
    this.elevationInputMarkId = undefined;
  }

  /** A file that is not a plan of this build leaves the current one untouched. */
  private adoptSerializedPlan(text: string): void {
    const plan = parseSnapshot(text);

    if (isNil(plan)) {
      this.fileIssue = 'import-failed';

      return;
    }

    this.replacePlan(plan);
  }

  private syncHistoryAvailability(): void {
    this.canUndo = this.history.canUndo();
    this.canRedo = this.history.canRedo();
  }

  private updateComposition(
    owner: ShapeOwner,
    update: (composition: ShapeComposition) => ShapeComposition
  ): void {
    if (owner === 'boundary') {
      this.boundary = update(this.boundary);

      return;
    }

    const building = findBuildingIn(this.buildings, owner);

    if (isNil(building)) {
      return;
    }

    this.buildings = updateBuildingIn(this.buildings, owner, {
      composition: update(building.composition),
    });
  }
}

/** What a selection points at, for the two kinds that point at a term operand. */
interface SelectedOperand {
  readonly owner: ShapeOwner;
  readonly operandId: ShapeId;
}

function selectedOperand(selection: Selection | undefined): SelectedOperand | undefined {
  if (isNil(selection)) {
    return undefined;
  }

  switch (selection.kind) {
    case 'shape':
      return { owner: selection.owner, operandId: selection.shapeId };
    case 'group':
      return { owner: selection.owner, operandId: selection.groupId };
    case 'mark':
    case 'tree':
    case 'car':
    case 'path':
    case 'building':
    case 'wall':
    case 'opening':
    case 'furniture':
    case 'device':
    case 'utilityRoute':
      return undefined;
    default:
      return assertNever(selection);
  }
}

/** Midday of the daylight — where a sun study opens before anything is dragged. */
function middleOf(window: DayWindow): number {
  return (window.sunriseMinutes + window.sunsetMinutes) / 2;
}

function findMark(marks: readonly ElevationMark[], markId: MarkId): ElevationMark | undefined {
  return marks.find(mark => mark.id === markId);
}

/**
 * Where a region's seed label lands: the centroid while it actually lies in
 * the region, an interior fallback otherwise — an annular exposed ceiling
 * centres on its own hole.
 */
function seedPointOf(polygons: MultiPolygon, centroid: Vector2 | undefined): Vector2 | undefined {
  if (!isNil(centroid) && isPointInMultiPolygon(polygons, centroid)) {
    return centroid;
  }

  return interiorPointOf(polygons);
}

const NO_ROOMS: readonly BuildingRoom[] = [];
const NO_STOREY_SCENES: readonly StoreyScene[] = [];

/**
 * Every storey resolved bottom-up (`building-editor.md` §5): the ground
 * storey stands on the building's composition, an upper one on the hull its
 * own walls enclose — which is what makes a smaller second floor a надстройка
 * and leaves the rest of the floor below as exposed ceiling. Each storey's
 * exposed ceiling — what the storey above does not cover — is cut into roof
 * zones the way rooms are cut out of a floor.
 */
function deriveStoreyScenes(
  building: Building,
  groundFootprint: MultiPolygon,
  padElevation: Meters | undefined
): readonly StoreyScene[] {
  const storeys = storeysOf(building);

  if (storeys.length === 0) {
    return NO_STOREY_SCENES;
  }

  const resolved: {
    readonly storey: Storey;
    readonly footprint: MultiPolygon;
    readonly wallBodies: MultiPolygon;
  }[] = storeys.map((storey, level) => {
    const wallBodies = buildWallBodies(storey.walls);

    return {
      storey,
      wallBodies,
      footprint: level === 0 ? groundFootprint : buildWallHull(wallBodies),
    };
  });

  let baseElevation = padElevation;

  return resolved.map(({ storey, footprint, wallBodies }, level) => {
    const storeyBase = baseElevation;

    if (!isNil(baseElevation)) {
      baseElevation += storey.heightMeters;
    }

    const above = resolved[level + 1]?.footprint ?? [];
    const exposed = subtractPolygons(footprint, above);

    return {
      storey,
      level,
      footprint,
      baseElevation: storeyBase,
      wallShapes: storey.walls.map(wall => ({
        id: wall.id,
        material: wall.material,
        polygons: buildWallBody(wall),
      })),
      wallBodies,
      openingShapes: storey.openings.flatMap(opening => {
        const wall = storey.walls.find(candidate => candidate.id === opening.wallId);

        return isNil(wall)
          ? []
          : [{ id: opening.id, kind: opening.kind, polygons: buildOpeningBody(wall, opening) }];
      }),
      rooms: deriveRooms(storey, footprint, wallBodies),
      roofZones: deriveRoofZones(storey, exposed),
      furniture: furnitureOf(storey),
      devices: devicesOf(storey).flatMap(device => {
        const position = devicePlanPosition(storey, device);

        return isNil(position) ? [] : [{ id: device.id, kind: device.kind, position }];
      }),
      wires: deriveWires(storey),
    };
  });
}

/** Where a device's symbol stands on the plan, its wall host resolved. */
function devicePlanPosition(storey: Storey, device: ElectricalDevice): Vector2 | undefined {
  const { host } = device;

  if (host.kind === 'ceiling') {
    return host.position;
  }

  const wall = storey.walls.find(candidate => candidate.id === host.wallId);

  if (isNil(wall)) {
    return undefined;
  }

  return pointAlongPolyline(wallCenterline(wall), host.offsetMeters);
}

/** An anchor for the wire router: the wall host, or the resolved free point. */
function deviceAnchor(device: ElectricalDevice): WireAnchor | undefined {
  if (device.host.kind === 'wall') {
    return {
      kind: 'wall',
      wallId: device.host.wallId,
      offsetMeters: device.host.offsetMeters,
    };
  }

  return { kind: 'point', position: device.host.position };
}

/**
 * The wiring the circuits imply (`building-editor.md` §7/§8): one run from
 * the panel to every consumer of its группа, walked along the walls, and a
 * dashed link from every switch to the light it commands.
 */
function deriveWires(storey: Storey): readonly PlanWire[] {
  const devices = devicesOf(storey);
  const byId = new Map(devices.map(device => [device.id, device]));
  const wires: PlanWire[] = [];
  const routeBetween = (fromId: DeviceId, toId: DeviceId): readonly Vector2[] | undefined => {
    const from = byId.get(fromId);
    const to = byId.get(toId);

    if (isNil(from) || isNil(to)) {
      return undefined;
    }

    const fromAnchor = deviceAnchor(from);
    const toAnchor = deviceAnchor(to);

    if (isNil(fromAnchor) || isNil(toAnchor)) {
      return undefined;
    }

    const points = routeWire(storey.walls, fromAnchor, toAnchor);

    return points.length > 1 ? points : undefined;
  };

  for (const group of groupsOf(storey)) {
    for (const deviceId of group.deviceIds) {
      const points = routeBetween(group.panelId, deviceId);

      if (!isNil(points)) {
        wires.push({ points, isSwitchLink: false });
      }
    }
  }

  for (const link of switchLinksOf(storey)) {
    const points = routeBetween(link.switchId, link.lightId);

    if (!isNil(points)) {
      wires.push({ points, isSwitchLink: true });
    }
  }

  return wires;
}

/**
 * The rooms the walls cut the footprint into: footprint minus wall bodies,
 * each remaining region one room, its type looked up by which region holds a
 * stored label's seed point.
 */
function deriveRooms(
  storey: Storey,
  footprint: MultiPolygon,
  wallBodies: MultiPolygon
): readonly BuildingRoom[] {
  if (wallBodies.length === 0 || footprint.length === 0) {
    return NO_ROOMS;
  }

  const cut = subtractPolygons(footprint, wallBodies);
  // A room is what the walls ENCLOSE. A footprint slightly wider than the
  // wall ring leaves a hairline frame between the walls and the slab's edge —
  // real leftover concrete, but no room — so regions outside the wall hull
  // are dropped. Until any enclosure exists (partitions running edge to edge,
  // the pre-ring way of drawing), the footprint boundary stands in for the
  // exterior walls and every cut region counts.
  const hull = buildWallHull(wallBodies);
  const enclosed = cut.filter(region => {
    const probe = interiorPointOf([region]);

    return !isNil(probe) && isPointInMultiPolygon(hull, probe);
  });
  const regions = enclosed.length > 0 ? enclosed : cut;

  return regions.map(region => {
    const polygons = [region];
    const label = storey.roomLabels.find(candidate =>
      isPointInMultiPolygon(polygons, candidate.position)
    );

    return {
      storeyId: storey.id,
      polygons,
      areaSquareMeters: multiPolygonArea(polygons),
      centroid: computeMultiPolygonCentroid(polygons),
      roomTypeId: label?.roomTypeId,
      labelId: label?.id,
      isWet: isNil(label) ? false : isWetRoomType(label.roomTypeId),
    };
  });
}

/** The roof-zone counterpart of {@link deriveRooms}, over the exposed ceiling. */
function deriveRoofZones(storey: Storey, exposed: MultiPolygon): readonly RoofZoneScene[] {
  return exposed.map(region => {
    const polygons = [region];
    const label = storey.roofZoneLabels.find(candidate =>
      isPointInMultiPolygon(polygons, candidate.position)
    );

    return {
      storeyId: storey.id,
      polygons,
      cover: label?.cover ?? DEFAULT_ROOF_COVER,
      areaSquareMeters: multiPolygonArea(polygons),
      centroid: computeMultiPolygonCentroid(polygons),
      labelId: label?.id,
    };
  });
}

/** Drops points that repeat the one before them, wherever the repetition came from. */
function dropRepeatedPoints(points: readonly Vector2[]): readonly Vector2[] {
  return points.filter((point, index) => index === 0 || !isEqual(point, points[index - 1]));
}

/**
 * Free function rather than a method: `makeAutoObservable` turns methods into
 * actions, and an action runs untracked — the section reads would not register
 * as dependencies of the computed that calls it.
 */
function resolveComposition(
  owner: ShapeOwner,
  boundary: ShapeComposition,
  buildings: readonly Building[]
): ShapeComposition | undefined {
  return owner === 'boundary' ? boundary : findBuildingIn(buildings, owner)?.composition;
}
