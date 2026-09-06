import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { IReactionDisposer } from 'mobx';
import { makeAutoObservable, observableRef, reaction } from 'mobx';
import { evaluateComposition } from '../domain/geometry/evaluate-composition';
import type { PathRibbon } from '../domain/geometry/path-ribbon';
import { buildPathRibbons } from '../domain/geometry/path-ribbon';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import type { BuildingId } from '../domain/model/building';
import type { Building } from '../domain/model/building';
import type { ActiveTool, EditorMode, EditTarget } from '../domain/model/editor-mode';
import { VIEW_MODE } from '../domain/model/editor-mode';
import type { CarInstance, SitePath, TreeInstance } from '../domain/model/plot-objects';
import type { UtilityRoute } from '../domain/model/routing';
import type { Selection, ShapeTool } from '../domain/model/selection';
import { DEFAULT_SHAPE_TOOL } from '../domain/model/selection';
import type { Shape, ShapeComposition } from '../domain/model/shapes';
import type { ElevationMark, SiteSettings } from '../domain/model/site-plan';
import { createDefaultSitePlan, utilityRoutesOf } from '../domain/model/site-plan';
import type { Slab } from '../domain/model/slabs';
import type { StoreyId } from '../domain/model/storeys';
import type { ISitePlanRepository } from '../domain/persistence/ISitePlanRepository';
import type { KeyPointSnap } from '../domain/view/object-snapping';
import type { OverlayMode } from '../domain/view/overlay-mode';
import type { SitePlannerViewMode } from '../domain/view/view-mode';
import { createIndexedDBSitePlanRepository } from '../infrastructure/IndexedDBSitePlanRepository';
import { BuildingModel } from './BuildingModel';
import { CompositionModel } from './CompositionModel';
import { DuctsModel } from './DuctsModel';
import type { PlanEditorCore } from './editor-core';
import type { EditorSession } from './editor-sessions';
import { EditorModesModel } from './EditorModesModel';
import { ElectricsModel } from './ElectricsModel';
import { ElevationMarksModel } from './ElevationMarksModel';
import { FurnitureModel } from './FurnitureModel';
import { OpeningsModel } from './OpeningsModel';
import { PlanDocumentModel } from './PlanDocumentModel';
import { PlanHistory } from './PlanHistory';
import { PlanPersistence } from './PlanPersistence';
import type { PathHandleHighlight } from './render/plan-draw/draw-paths';
import { RoofModel } from './RoofModel';
import { SceneModel } from './SceneModel';
import { SelectionCommands } from './SelectionCommands';
import { SiteObjectsModel } from './SiteObjectsModel';
import { StairsModel } from './StairsModel';
import { StoreyObjectsEditorModel } from './StoreyObjectsEditorModel';
import { StoreysModel } from './StoreysModel';
import { SunStudy } from './SunStudy';
import { TerrainModel } from './TerrainModel';
import { ToolingModel } from './ToolingModel';
import { UtilityNetworkModel } from './UtilityNetworkModel';
import { ViewportModel } from './ViewportModel';
import { WallDraftModel } from './WallDraftModel';
import { WallEditorModel } from './WallEditorModel';

const NO_MEASURE_POINTS: readonly Vector2[] = [];
const NO_SELECTIONS: readonly Selection[] = [];

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
  /** The sun study — its own object ({@link SunStudy}). */
  readonly sun: SunStudy;

  /** The terrain as derived from the document ({@link TerrainModel}). */
  readonly terrain: TerrainModel;

  /** The 3D resolution of the plan ({@link SceneModel}). */
  readonly scene: SceneModel;

  /** The utility networks ({@link UtilityNetworkModel}). */
  readonly utilities: UtilityNetworkModel;

  /** What stands on the plot outside the buildings ({@link SiteObjectsModel}). */
  readonly siteObjects: SiteObjectsModel;

  /** The surveyed elevation marks and the field floating by a flag ({@link ElevationMarksModel}). */
  readonly marks: ElevationMarksModel;

  /** The CSG side of the plan ({@link CompositionModel}). */
  readonly composition: CompositionModel;

  /** The buildings as buildings ({@link BuildingModel}). */
  readonly building: BuildingModel;

  /** The edited building's storey stack and the active level ({@link StoreysModel}). */
  readonly storeys: StoreysModel;

  /** The edited building's pitched roof and roof-zone covers ({@link RoofModel}). */
  readonly roof: RoofModel;

  /** The open building's storey furnishings ({@link StoreyObjectsEditorModel}). */
  readonly storeyObjects: StoreyObjectsEditorModel;

  /** The open building's stairs ({@link StairsModel}). */
  readonly stairs: StairsModel;

  /** The open building's fireplaces, flues and ventilation shafts ({@link DuctsModel}). */
  readonly ducts: DuctsModel;

  /** The open building's furniture ({@link FurnitureModel}). */
  readonly furniture: FurnitureModel;

  /** The open building's electrical devices and their wiring ({@link ElectricsModel}). */
  readonly electrics: ElectricsModel;

  /** The open building's committed walls and their junctions ({@link WallEditorModel}). */
  readonly walls: WallEditorModel;

  /** The wall polyline in flight and its typed-length keyboard path ({@link WallDraftModel}). */
  readonly wallDraft: WallDraftModel;

  /** The doors and windows on their host walls ({@link OpeningsModel}). */
  readonly openings: OpeningsModel;

  /** Shift-click, Delete and Ctrl+D over everything selected ({@link SelectionCommands}). */
  readonly selectionCommands: SelectionCommands;

  /** How the plan is looked at ({@link ViewportModel}): viewport, camera heading, layers, cursor. */
  readonly view = new ViewportModel();

  /** The undo stack and its announce-then-commit protocol ({@link PlanHistory}). */
  readonly history = new PlanHistory();

  /** The tools in hand, the view and the overlay ({@link ToolingModel}). */
  readonly tooling: ToolingModel;

  /** The plan as one document: snapshot, settings, undo/redo, adopting a file ({@link PlanDocumentModel}). */
  readonly document: PlanDocumentModel;

  /** View or one opened editor, and its session ({@link EditorModesModel}). */
  readonly modes: EditorModesModel;
  /** Storage, autosave and file exchange ({@link PlanPersistence}). */
  readonly persistence: PlanPersistence;

  private readonly disposeHistoryCommit: IReactionDisposer;

  constructor(repository: ISitePlanRepository = createIndexedDBSitePlanRepository()) {
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
    this.marks = new ElevationMarksModel(this);
    this.composition = new CompositionModel(this);
    this.modes = new EditorModesModel(this, this.composition);
    this.tooling = new ToolingModel(this, {
      sun: this.sun,
      marks: this.marks,
      siteObjects: this.siteObjects,
      utilities: this.utilities,
    });
    this.document = new PlanDocumentModel(this, this.history, this.tooling);
    this.persistence = new PlanPersistence(this.document, repository);
    this.building = new BuildingModel(this, this.scene, this.composition);
    this.storeys = new StoreysModel(this, this.scene);
    this.roof = new RoofModel(this, this.scene);
    this.storeyObjects = new StoreyObjectsEditorModel(this, this.scene, this.storeys);
    this.stairs = new StairsModel(this, this.storeys);
    this.ducts = new DuctsModel(this, this.scene, this.storeys);
    this.furniture = new FurnitureModel(this, this.storeys);
    this.electrics = new ElectricsModel(this, this.storeys);
    this.walls = new WallEditorModel(this, this.scene, this.storeys, this.storeyObjects);
    this.wallDraft = new WallDraftModel(this, this.storeys, this.storeyObjects);
    this.openings = new OpeningsModel(this);
    this.selectionCommands = new SelectionCommands(this, this);

    makeAutoObservable<SitePlannerStore, 'disposeHistoryCommit' | 'selectionCommands'>(
      this,
      {
        history: false,
        selectionCommands: false,
        persistence: false,
        view: false,
        disposeHistoryCommit: false,
        boundary: observableRef,
        elevationMarks: observableRef,
        buildings: observableRef,
        trees: observableRef,
        cars: observableRef,
        paths: observableRef,
        utilityRoutes: observableRef,
        settings: observableRef,
        selections: observableRef,
        measurePoints: observableRef,
        draftShape: observableRef,
        draftMark: observableRef,
        activeKeyPointSnap: observableRef,
        pathHandleHighlight: observableRef,
        editorMode: observableRef,
        editorSession: observableRef,
      },
      { autoBind: true }
    );

    this.disposeHistoryCommit = reaction(() => this.document.snapshot, this.history.commit);

    void this.persistence.start();
  }

  /** The plot as the boolean fold leaves it: outer rings plus their holes. */
  get boundaryPolygons(): MultiPolygon {
    return evaluateComposition(this.boundary);
  }

  /** One ribbon per path, in plan order, so a path keeps its identity downstream. */
  get pathRibbons(): readonly PathRibbon[] {
    return buildPathRibbons(this.paths);
  }

  /** Every ribbon as one multi-polygon — what the 3D view drapes over the ground. */
  get pathRibbonPolygons(): MultiPolygon {
    return this.pathRibbons.flatMap(ribbon => ribbon.polygons);
  }

  /** Announces an edit — see {@link PlanHistory.announce} for the protocol. */
  pushHistory(groupKey?: string): void {
    this.history.announce(this.document.snapshot, groupKey);
  }

  /** {@link PlanEditorCore}: the tools live on {@link ToolingModel}. */
  setViewMode(viewMode: SitePlannerViewMode): void {
    this.tooling.setViewMode(viewMode);
  }

  setActiveTool(activeTool: ActiveTool): void {
    this.tooling.setActiveTool(activeTool);
  }

  /** {@link PlanEditorCore}: the modes live on {@link EditorModesModel}. */
  enterEditMode(target: EditTarget): void {
    this.modes.enterEditMode(target);
  }

  exitEditMode(): void {
    this.modes.exitEditMode();
  }

  get selectedPathPointIndex(): number | undefined {
    return this.modes.selectedPathPointIndex;
  }

  setSelectedPathPointIndex(index: number | undefined): void {
    this.modes.setSelectedPathPointIndex(index);
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

  /** {@link PlanEditorCore}: the panel focus lives on {@link ToolingModel}. */
  requestPropertiesFocus(): void {
    this.tooling.requestPropertiesFocus();
  }

  /** Runs a command whose several edits are one step of history. */
  runBatched(command: VoidFunction): void {
    this.history.runBatched(command);
  }

  /** {@link PlanEditorCore}: the active storey lives on the building model. */
  get activeStoreyId(): StoreyId | undefined {
    return this.storeys.activeStoreyId;
  }

  /** {@link PlanEditorCore}: the slabs live on the storey-objects editor. */
  get activeStoreySlabs(): readonly Slab[] {
    return this.storeyObjects.activeStoreySlabs;
  }

  /** {@link PlanEditorCore}: slab edits live on the storey-objects editor. */
  updateSlab(buildingId: BuildingId, slab: Slab): void {
    this.storeyObjects.updateSlab(buildingId, slab);
  }

  /** Teardown hook honoured by the refcounted feature-store lifecycle. */
  dispose(): void {
    this.editorSession?.dispose();
    this.editorSession = undefined;
    this.disposeHistoryCommit();
    this.persistence.dispose();
    this.view.dispose();
    this.sun.dispose();
    this.terrain.dispose();
    this.scene.dispose();
    this.utilities.dispose();
    this.siteObjects.dispose();
    this.marks.dispose();
    this.composition.dispose();
    this.modes.dispose();
    this.tooling.dispose();
    this.document.dispose();
    this.building.dispose();
    this.storeys.dispose();
    this.roof.dispose();
    this.storeyObjects.dispose();
    this.stairs.dispose();
    this.ducts.dispose();
    this.furniture.dispose();
    this.electrics.dispose();
    this.walls.dispose();
    this.wallDraft.dispose();
    this.openings.dispose();
  }
}
