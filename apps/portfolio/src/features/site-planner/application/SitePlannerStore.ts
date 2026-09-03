import { assertNever } from '@frozik/utils/assert/assertNever';
import { createHistory } from '@frozik/utils/history/createHistory';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isEqual, isNil } from 'lodash-es';
import type { IReactionDisposer } from 'mobx';
import { makeAutoObservable, observableRef, reaction, runInAction } from 'mobx';
import { evaluateComposition } from '../domain/geometry/evaluate-composition';
import { offsetPolygons } from '../domain/geometry/offset-polygon';
import type { PathRibbon } from '../domain/geometry/path-ribbon';
import { buildPathRibbons } from '../domain/geometry/path-ribbon';
import type { MultiPolygon } from '../domain/geometry/polygon-types';

// The scene types live with the derivation that produces them; the store
// re-exports them so every consumer keeps the import path it already uses.
export type {
  BuildingRoom,
  PlanDevice,
  PlanOpeningShape,
  PlanWire,
  RoofZoneScene,
  StairScene,
  StoreyScene,
  SupportScene,
} from './storey-scenes';

import type { BuildingWarning } from '../domain/model/building-warnings';
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
import type { UtilityRoute } from '../domain/model/routing';
import type { Selection, ShapeTool } from '../domain/model/selection';
import {
  DEFAULT_SHAPE_TOOL,
  isSameSelection,
  isShapeTool,
  SELECTION_SCOPE,
} from '../domain/model/selection';
import type { SiteSettingsChanges } from '../domain/model/settings-edits';
import { updateSettings as updateSettingsWith } from '../domain/model/settings-edits';
import type { Shape, ShapeComposition } from '../domain/model/shapes';
import type {
  Building,
  BuildingId,
  CarInstance,
  ElevationMark,
  SitePath,
  SitePlan,
  SiteSettings,
  TreeInstance,
} from '../domain/model/site-plan';
import { createDefaultSitePlan, utilityRoutesOf } from '../domain/model/site-plan';
import type { Slab } from '../domain/model/slabs';
import { parseSnapshot } from '../domain/model/snapshot';
import { selectedStoreyObject } from '../domain/model/storey-object-selection';
import type { StoreyId } from '../domain/model/storeys';
import type { ISitePlanRepository } from '../domain/persistence/ISitePlanRepository';
import type { Meters } from '../domain/units';
import type { KeyPointSnap } from '../domain/view/object-snapping';
import type { OverlayMode } from '../domain/view/overlay-mode';
import type { PlanModifiers } from '../domain/view/plan-input';
import { NO_MODIFIERS } from '../domain/view/plan-input';
import type { PlanLayerKind } from '../domain/view/plan-layers';
import { ALL_PLAN_LAYERS, togglePlanLayer } from '../domain/view/plan-layers';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { createPlanViewport, DEFAULT_PIXELS_PER_METER } from '../domain/view/plan-viewport';
import type { SitePlannerViewMode } from '../domain/view/view-mode';
import { createIndexedDBSitePlanRepository } from '../infrastructure/IndexedDBSitePlanRepository';
import { lookupTimeZoneId } from '../infrastructure/timezone-lookup';
import { BuildingModel } from './BuildingModel';
import { CompositionModel } from './CompositionModel';
import type { PlanEditorCore } from './editor-core';
import type { EditorSession } from './editor-sessions';
import { createEditorSession } from './editor-sessions';
import type { PathHandleHighlight } from './render/plan-draw/draw-paths';
import { SceneModel } from './SceneModel';
import { SiteObjectsModel } from './SiteObjectsModel';
import { StoreyObjectsEditorModel } from './StoreyObjectsEditorModel';
import { SunStudy } from './SunStudy';
import { TerrainModel } from './TerrainModel';
import { UtilityNetworkModel } from './UtilityNetworkModel';
import { WallEditorModel } from './WallEditorModel';

/**
 * How often the day animation advances, and by how much. Fifty milliseconds is
 * below what reads as a step, and three minutes of sun per tick sweeps a summer
 * day in about twenty seconds — long enough to watch a shadow travel, short
 * enough not to wait for it.
 */

/** Which consumer of the site plan is on screen: the 2D plan editor or the 3D view. */

/**
 * Which analysis is coloured over the ground, in both views at once. It is a
 * way of looking at the plan rather than part of it, so — like the sun study —
 * it stays out of the snapshot, out of storage and out of the undo stack.
 */

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
const NO_SELECTIONS: readonly Selection[] = [];

/** A calibration is exactly two points on the picture plus the span between them. */

const PERCENT_SCALE = 100;

export class SitePlannerStore implements PlanEditorCore {
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
  /**
   * What is selected, in the order it was picked. Kept as a LIST so a group of
   * things can be moved, duplicated or deleted at once — «change the material
   * of these six walls» was twelve clicks while it was a single value. Every
   * existing reader takes {@link selection}, the last one picked, so the
   * single-selection paths are unchanged.
   */
  selections: readonly Selection[] = NO_SELECTIONS;
  /** Ad-hoc ruler anchors, consumed as consecutive pairs; cleared on tool change. */
  measurePoints: readonly Vector2[] = NO_MEASURE_POINTS;
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

  viewMode: SitePlannerViewMode = 'plan';
  /** Pointer position in plan metres, for the status-bar readout. */
  cursorPlanPoint: Vector2 | undefined = undefined;
  /**
   * Modifiers held at the last pointer move. The draft previews read them so
   * the segment on screen is the segment a click would commit — Shift locking
   * it square is only honest if the preview is locked too.
   */
  cursorModifiers: PlanModifiers = NO_MODIFIERS;
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
   * The sun study — its own object ({@link SunStudy}), because it is a concern
   * with state and a running timer of its own rather than eight more fields
   * here. Ephemeral by design: a way of looking at the plan rather than part
   * of it, so it stays out of the snapshot, storage and the undo stack.
   */
  readonly sun: SunStudy;

  /**
   * The terrain as derived from the document ({@link TerrainModel}): the
   * interpolated survey, contours, pads and the graded ground. Stateless —
   * every member is a computed over this store's own observables.
   */
  readonly terrain: TerrainModel;

  /**
   * The 3D resolution of the plan ({@link SceneModel}): building scenes,
   * meshes, analysis overlays, the advisory pass. Stateless like the terrain.
   */
  readonly scene: SceneModel;

  /**
   * The utility networks ({@link UtilityNetworkModel}): trench drafting and
   * editing, entries, the norm pass. Owns the draft state of the trench tool.
   */
  readonly utilities: UtilityNetworkModel;

  /**
   * What stands on the plot outside the buildings ({@link SiteObjectsModel}):
   * marks, trees, cars, paths and the placement tool. Owns the path draft.
   */
  readonly siteObjects: SiteObjectsModel;

  /**
   * The CSG side of the plan ({@link CompositionModel}): terms, groups and
   * the active-group arming shared by the shape tools.
   */
  readonly composition: CompositionModel;

  /**
   * The buildings as buildings ({@link BuildingModel}): lifecycle, pad and
   * foundation, storeys and the active one, the roof, the room labels.
   */
  readonly building: BuildingModel;

  /**
   * The open building's storey furnishings ({@link StoreyObjectsEditorModel}):
   * stairs, supports, slabs, fireplaces, ducts, furniture and electrics.
   */
  readonly storeyObjects: StoreyObjectsEditorModel;

  /**
   * The open building's walls and openings ({@link WallEditorModel}), with
   * the wall-draft polyline and its typed-length keyboard path.
   */
  readonly walls: WallEditorModel;

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
  private saveRequestId = 0;
  private isDisposed = false;
  /** True while one command is applying several edits — see `runBatched`. */
  private isBatchingHistory = false;

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
    this.sun = new SunStudy(() => this.settings.location);
    this.terrain = new TerrainModel(this);
    this.scene = new SceneModel(this, this.terrain);
    this.utilities = new UtilityNetworkModel(this, this.terrain, this.scene);
    this.siteObjects = new SiteObjectsModel(this, this.utilities);
    this.composition = new CompositionModel(this);
    this.building = new BuildingModel(this, this.scene, this.composition);
    this.storeyObjects = new StoreyObjectsEditorModel(this, this.scene, this.building);
    this.walls = new WallEditorModel(this, this.scene, this.building, this.storeyObjects);

    makeAutoObservable<
      SitePlannerStore,
      | 'repository'
      | 'history'
      | 'pendingHistoryPlan'
      | 'lastRecordedGroupKey'
      | 'lastRecordedAtMs'
      | 'disposeHistoryCommit'
      | 'disposeAutosave'
      | 'saveRequestId'
      | 'isDisposed'
      | 'isBatchingHistory'
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
        saveRequestId: false,
        isDisposed: false,
        boundary: observableRef,
        elevationMarks: observableRef,
        buildings: observableRef,
        trees: observableRef,
        cars: observableRef,
        paths: observableRef,
        utilityRoutes: observableRef,
        settings: observableRef,
        selections: observableRef,
        isBatchingHistory: false,
        measurePoints: observableRef,
        draftShape: observableRef,
        draftMark: observableRef,
        activeKeyPointSnap: observableRef,
        cursorPlanPoint: observableRef,
        pathHandleHighlight: observableRef,
        editorMode: observableRef,
        editorSession: observableRef,
        viewport: observableRef,
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

  /** 100 % is the zoom a freshly opened plan starts at. */
  get zoomPercent(): number {
    return Math.round((this.viewport.pixelsPerMeter / DEFAULT_PIXELS_PER_METER) * PERCENT_SCALE);
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
    this.selections = NO_SELECTIONS;
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
    // Inside a batch the first push already captured the state before the
    // whole operation; the rest would each start a step of their own and one
    // undo would take back only part of what one command did.
    if (this.isBatchingHistory) {
      return;
    }

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

    // The two views are two windows onto one plan, so the editing session
    // survives the switch: which building is open, which storey is active and
    // what the tool is armed with are not 2D state. Dropping them here made
    // Tab a silent way to lose your place — and made showing the active storey
    // in 3D impossible, because arriving there always ended the session first.
    // Canvas gestures are still the plan's; the 3D view stays a viewer.

    // Nothing watches the sun outside the 3D view, and a timer left running
    // would keep recomputing a light nobody is looking at.
    if (viewMode !== 'scene') {
      this.sun.stopAnimation();
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

  /** The overlay segment of the toolbar; it colours the plan and the 3D view alike. */
  setOverlayMode(overlayMode: OverlayMode): void {
    this.overlayMode = overlayMode;
  }

  /** Switching tools abandons whatever the previous one had in flight. */
  /**
   * One-shot placement (R30): the moment an object lands, the tool hands it
   * over to the select tool with the object selected, so the very next click
   * adjusts what was just placed instead of dropping a second one beside it —
   * the direct-manipulation habit of Figma and Planner 5D. The tool's own key
   * or its rail button re-arms it for the next one.
   *
   * Two kinds of tool stay in hand instead. Those that draw a RUN — walls,
   * paths, trenches, elevation marks — because their gesture already says when
   * it is finished. And furniture and electrics, because furnishing a room and
   * wiring a storey ARE runs of placements: 💬 the sofa is followed by the
   * table, the socket by the next socket.
   */
  finishPlacement(): void {
    this.setActiveTool('select');
  }

  /**
   * Arms a primitive without reaching for a tool. The plot's shape tool and the
   * building's slab tool draw the SAME primitives, so they share the armed one:
   * whichever was last picked is what both of them draw.
   */
  setArmedShapeTool(armedShapeTool: ShapeTool): void {
    this.armedShapeTool = armedShapeTool;
  }

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
    this.siteObjects.closeElevationInput();
    this.measurePoints = NO_MEASURE_POINTS;
    this.siteObjects.cancelDraftPath();
  }

  /** The last thing picked: what the properties panel and the gestures read. */
  get selection(): Selection | undefined {
    return this.selections[this.selections.length - 1];
  }

  setSelection(selection: Selection | undefined): void {
    this.setSelections(isNil(selection) ? NO_SELECTIONS : [selection]);
  }

  setSelections(selections: readonly Selection[]): void {
    this.selections = selections;

    if (this.selection?.kind !== 'path') {
      this.setSelectedPathPointIndex(undefined);
    }
  }

  /**
   * Shift-click: adds what was clicked to the selection, or takes it back out.
   * The market's grammar — Figma, Blender, SketchUp all read Shift this way.
   */
  toggleSelection(selection: Selection): void {
    const without = this.selections.filter(candidate => !isSameSelection(candidate, selection));

    this.setSelections(
      without.length === this.selections.length ? [...this.selections, selection] : without
    );
  }

  /** Whether this exact thing is among the selected — what the plan draws lit. */
  isSelected(selection: Selection): boolean {
    return this.selections.some(candidate => isSameSelection(candidate, selection));
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
      this.composition.setActiveGroup('boundary');
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
      this.composition.setActiveGroup(door.aimAt);
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

    // Selections belonging to the closed editor go with it; the ones that
    // live on the plan stay. Filtering the whole list — not just the last
    // one picked — is what makes this right for a multiple selection.
    this.setSelections(
      this.selections.filter(candidate => SELECTION_SCOPE[candidate.kind] === 'view')
    );
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

  /** Whether site editing is currently aimed at one of the buildings. */
  get isEditingBuilding(): boolean {
    return isSiteEditMode(this.editorMode) && this.composition.activeGroup.owner !== 'boundary';
  }

  /** What the mode bar names as being edited, or nothing while viewing. */
  get editedObject(): EditedObjectDescriptor | undefined {
    return describeEditedObject(this.editorMode, {
      activeOwner: this.composition.activeGroup.owner,
      buildings: this.buildings,
      paths: this.paths,
      utilityRoutes: this.utilityRoutes,
    });
  }

  setMeasurePoints(measurePoints: readonly Vector2[]): void {
    this.measurePoints = measurePoints;
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

  setCursorModifiers(cursorModifiers: PlanModifiers): void {
    this.cursorModifiers = cursorModifiers;
  }

  setCursorPlanPoint(cursorPlanPoint: Vector2 | undefined): void {
    this.cursorPlanPoint = cursorPlanPoint;
  }

  setViewport(viewport: PlanViewport): void {
    this.viewport = viewport;
  }

  /** Brings a point of the plan to the middle of the view — «take me there». */
  centreOn(point: Vector2): void {
    this.viewport = { ...this.viewport, centerMeters: point };
  }

  /**
   * Answers a finding in the Замечания panel: aims the editor at the storey it
   * belongs to and brings its place into view. A list of findings is only
   * useful if each row is a way to get to the thing it is about.
   */
  revealWarning(warning: BuildingWarning): void {
    this.setViewMode('plan');
    this.building.setActiveStorey(warning.storeyId);
    this.centreOn(warning.at);
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

  /** The IANA zone a picked point keeps, or nothing where the table is silent. */
  timeZoneIdAt(latitudeDegrees: number, longitudeDegrees: number): string | undefined {
    return lookupTimeZoneId(latitudeDegrees, longitudeDegrees);
  }

  /** Deletes everything selected — one step to undo, however many things. */
  removeSelected(): void {
    const { selections } = this;

    if (selections.length === 0) {
      return;
    }

    this.pushHistory();
    this.runBatched(() => {
      for (const selection of selections) {
        this.removeOneSelected(selection);
      }
    });
    this.setSelections(NO_SELECTIONS);
  }

  /** Runs a command whose several edits are one step of history. */
  runBatched(command: VoidFunction): void {
    this.isBatchingHistory = true;

    try {
      command();
    } finally {
      this.isBatchingHistory = false;
    }
  }

  /**
   * Duplicates whatever is selected, offset by one grid step so the copies
   * are visible and grabbable rather than hidden exactly under the originals.
   * The copies become the selection, so a second Ctrl+D steps on again.
   */
  duplicateSelected(): void {
    const { selections } = this;

    if (selections.length === 0) {
      return;
    }

    this.pushHistory();

    const offset = this.settings.gridStepMeters;
    const copies: Selection[] = [];

    this.runBatched(() => {
      for (const selection of selections) {
        copies.push(...this.duplicateOne(selection, offset));
      }
    });

    if (copies.length > 0) {
      this.setSelections(copies);
    }
  }

  /** One object's copy, placed a step away; nothing for what cannot be copied. */
  /**
   * One object's copy, placed a step away; nothing for what cannot be copied.
   *
   * Every storey object copies the same way — find it, mint an id, shift it,
   * put it on the active storey, hand back its selection — so that dance
   * lives once in {@link copyStoreyObject} and a kind contributes only what
   * is different about it. Adding the next kind is three lines here.
   */
  private duplicateOne(selection: Selection, offsetMeters: Meters): readonly Selection[] {
    const selected = selectedStoreyObject(selection);
    const storeyId = this.building.activeStoreyId;

    // Walls, openings, rooms and site shapes are not copied: each has a host or
    // a place in a tree that a blind offset would misplace, so their kinds
    // contribute no `duplicate` to the table.
    if (isNil(selected) || isNil(storeyId) || isNil(selected.selector.duplicate)) {
      return NO_SELECTIONS;
    }

    const copied = selected.selector.duplicate({
      buildings: this.buildings,
      buildingId: selected.buildingId,
      storeyId,
      id: selected.id,
      offset: { x: offsetMeters, y: offsetMeters },
    });

    if (isNil(copied)) {
      return NO_SELECTIONS;
    }

    this.buildings = copied.buildings;

    return [copied.selection];
  }

  private removeOneSelected(selection: Selection): void {
    switch (selection.kind) {
      case 'shape':
        this.composition.removeTerm(selection.owner, selection.shapeId);

        return;
      case 'group':
        this.composition.removeTerm(selection.owner, selection.groupId);

        return;
      case 'mark':
        this.siteObjects.removeElevationMark(selection.markId);

        return;
      case 'tree':
        this.siteObjects.removeTree(selection.treeId);

        return;
      case 'car':
        this.siteObjects.removeCar(selection.carId);

        return;
      case 'path':
        this.siteObjects.removePath(selection.pathId);

        return;
      case 'utilityRoute':
        this.utilities.removeUtilityRoute(selection.routeId);

        return;
      case 'building':
        this.building.removeBuilding(selection.buildingId);

        return;
      case 'wall':
        this.walls.removeWall(selection.buildingId, selection.wallId);

        return;
      case 'opening':
        this.walls.removeOpening(selection.buildingId, selection.openingId);

        return;
      case 'furniture':
      case 'device':
      case 'stair':
      case 'support':
      case 'slab':
      case 'fireplace':
      case 'duct':
        this.storeyObjects.removeSelectedStoreyObject(selection);

        return;
      case 'utilityEntry':
        this.utilities.removeUtilityEntry(selection.buildingId, selection.entryId);

        return;
      default:
        assertNever(selection);
    }
  }

  /** {@link PlanEditorCore}: the active storey lives on the building model. */
  get activeStoreyId(): StoreyId | undefined {
    return this.building.activeStoreyId;
  }

  /** {@link PlanEditorCore}: the slabs live on the storey-objects editor. */
  get activeStoreySlabs(): readonly Slab[] {
    return this.storeyObjects.activeStoreySlabs;
  }

  /** {@link PlanEditorCore}: slab edits live on the storey-objects editor. */
  updateSlab(buildingId: BuildingId, slab: Slab): void {
    this.storeyObjects.updateSlab(buildingId, slab);
  }

  /**
   * Sweeps the plot clean: every placed object — buildings, trees, cars,
   * paths, trenches — gone in ONE undo step. The plot itself survives: its
   * boundary, elevation marks and settings are the site, not objects on it.
   */
  clearSite(): void {
    this.exitEditMode();
    this.siteObjects.cancelDraftPath();
    this.utilities.cancelDraftUtilityRoute();
    this.pushHistory();
    this.buildings = [];
    this.trees = [];
    this.cars = [];
    this.paths = [];
    this.utilityRoutes = [];
    this.selections = NO_SELECTIONS;
  }

  /** Teardown hook honoured by the refcounted feature-store lifecycle. */
  dispose(): void {
    this.isDisposed = true;
    this.editorSession?.dispose();
    this.editorSession = undefined;
    this.sun.stopAnimation();
    this.disposeHistoryCommit();
    this.disposeAutosave?.();
    this.disposeAutosave = undefined;
  }

  /**
   * One tick of the day animation: the sun moves on, and the sunset sends it
   * back to the sunrise so the day plays as a loop.
   */

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
    this.siteObjects.cancelDraftPath();
    this.utilities.cancelDraftUtilityRoute();
    this.siteObjects.closeElevationInput();
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
}
