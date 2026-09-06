import type { Vector2 } from '@frozik/utils/math/vector2';
import type { PathRibbon } from '../domain/geometry/path-ribbon';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import type { BuildingId } from '../domain/model/building';
import type { Building } from '../domain/model/building';
import type { ActiveTool, EditorMode, EditTarget } from '../domain/model/editor-mode';
import type { CarInstance, SitePath, TreeInstance } from '../domain/model/plot-objects';
import type { UtilityRoute } from '../domain/model/routing';
import type { Selection, ShapeTool } from '../domain/model/selection';
import type { Shape, ShapeComposition } from '../domain/model/shapes';
import type { ElevationMark, SiteSettings } from '../domain/model/site-plan';
import type { Slab } from '../domain/model/slabs';
import type { StoreyId } from '../domain/model/storeys';
import type { KeyPointSnap } from '../domain/view/object-snapping';
import type { OverlayMode } from '../domain/view/overlay-mode';
import type { SitePlannerViewMode } from '../domain/view/view-mode';
import type { EditorSession } from './editor-sessions';
import type { PathHandleHighlight } from './render/plan-draw/draw-paths';
import type { ViewportModel } from './ViewportModel';

/**
 * The slice of the planner store its collaborator models read. Collaborators
 * (TerrainModel, SunStudy's successors) hold this interface, never the store
 * class itself — the store imports them to compose itself, so an import in the
 * other direction would be a cycle. Property reads through it land on the
 * store's own observables, so a collaborator's computeds track as if inline.
 */
export interface PlanEditorCore {
  readonly boundaryPolygons: MultiPolygon;
  /** The document collections an editor command replaces wholesale. */
  buildings: readonly Building[];
  settings: SiteSettings;
  readonly pathRibbons: readonly PathRibbon[];
  overlayMode: OverlayMode;
  viewMode: SitePlannerViewMode;
  editorMode: EditorMode;
  editorSession: EditorSession | undefined;
  readonly activeStoreyId: StoreyId | undefined;
  utilityRoutes: readonly UtilityRoute[];
  selections: readonly Selection[];
  readonly selection: Selection | undefined;
  readonly view: ViewportModel;
  readonly pathRibbonPolygons: MultiPolygon;
  elevationMarks: readonly ElevationMark[];
  trees: readonly TreeInstance[];
  cars: readonly CarInstance[];
  paths: readonly SitePath[];
  readonly selectedPathPointIndex: number | undefined;
  boundary: ShapeComposition;
  readonly activeStoreySlabs: readonly Slab[];
  draftShape: Shape | undefined;
  draftMark: ElevationMark | undefined;
  activeKeyPointSnap: KeyPointSnap | undefined;
  measurePoints: readonly Vector2[];
  pathHandleHighlight: PathHandleHighlight | undefined;
  activeTool: ActiveTool;
  updateSlab(buildingId: BuildingId, slab: Slab): void;
  pushHistory(groupKey?: string): void;
  exitEditMode(): void;
  enterEditMode(target: EditTarget): void;
  setSelection(selection: Selection | undefined): void;
  setSelections(selections: readonly Selection[]): void;
  setSelectedPathPointIndex(index: number | undefined): void;
  requestPropertiesFocus(): void;
  armedShapeTool: ShapeTool;
  setViewMode(viewMode: SitePlannerViewMode): void;
  setActiveTool(activeTool: ActiveTool): void;
  runBatched(command: VoidFunction): void;
}
