import type { Vector2 } from '@frozik/utils/math/vector2';
import type { SegmentReadout } from '../../../domain/geometry/draw-constraints';
import type { PathRibbon } from '../../../domain/geometry/path-ribbon';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { BuildingId } from '../../../domain/model/building';
import type { DuctId } from '../../../domain/model/ducts';
import type { EditTarget } from '../../../domain/model/editor-mode';
import type { DeviceId } from '../../../domain/model/electrical';
import type { FireplaceId } from '../../../domain/model/fireplaces';
import type { UtilitySystem } from '../../../domain/model/foundation';
import type { FurnitureInstance } from '../../../domain/model/furniture';
import type { OpeningId } from '../../../domain/model/openings';
import type {
  CarInstance,
  SitePath,
  TreeId,
  TreeInstance,
} from '../../../domain/model/plot-objects';
import type { RoomTypeId } from '../../../domain/model/rooms';
import type { UtilityRoute } from '../../../domain/model/routing';
import type { Shape, ShapeId } from '../../../domain/model/shapes';
import type { ElevationMark, MarkId } from '../../../domain/model/site-plan';

import type { StairId } from '../../../domain/model/stairs';
import type { SupportId } from '../../../domain/model/supports';
import type { Wall } from '../../../domain/model/walls';
import type { AnalysisRaster } from '../../../domain/terrain/analysis-raster';
import type { ContourPolyline } from '../../../domain/terrain/contour-types';
import type { Meters } from '../../../domain/units';
import type { KeyPointSnap } from '../../../domain/view/object-snapping';
import type { PlanLayerKind } from '../../../domain/view/plan-layers';
import type { AnalysisRasterImage } from './draw-analysis-raster';
import type { FlowField } from './draw-flow-arrows';
import type { PlanBuilding } from './draw-house';
import type { PathDraft, PathHandleHighlight } from './draw-paths';
import type { UtilityRouteDraft } from './draw-utility-routes';
/** Localised chrome captions; the drawing modules stay free of i18n. */
export interface PlanLabels {
  readonly meterUnit: string;
  readonly northLabel: string;
  /** Prefix of the pad elevation captioned on the footprint. */
  readonly padLabelPrefix: string;
  /** One letter per system, worn by the entry badges on the outline. */
  readonly entryLetters: Readonly<Record<UtilitySystem, string>>;
  /** Room-type captions for the derived rooms inside the building editor. */
  readonly roomTypeNames: Readonly<Record<RoomTypeId, string>>;
  readonly squareMeterUnit: string;
  /** «ВВЕРХ»: which way a stair climbs, stated beside it on the sheet. */
  readonly stairUp: string;
}

/** The plan itself: everything a printed sheet is made of. */
export interface PlanContent {
  readonly boundaryPolygons: MultiPolygon;
  readonly buildings: readonly PlanBuilding[];
  readonly setbackRings: MultiPolygon;
  readonly contours: readonly ContourPolyline[];
  /** The active analysis, coloured on the CPU; nothing while no overlay is on. */
  readonly analysisRaster: AnalysisRaster | undefined;
  /** The ground the runoff arrows read; nothing outside the slope overlay. */
  readonly flowField: FlowField | undefined;
  readonly elevationMarks: readonly ElevationMark[];
  readonly trees: readonly TreeInstance[];
  readonly cars: readonly CarInstance[];
  readonly pathRibbons: readonly PathRibbon[];
  readonly utilityRoutes: readonly UtilityRoute[];
  readonly gridStepMeters: Meters;
  readonly northOffsetDegrees: number;
  readonly visibleLayers: ReadonlySet<PlanLayerKind>;
}

/** What the editor draws over the plan; a sheet carries none of it. */
export interface PlanEditorChrome {
  /** The polyline being clicked out with the path tool; nothing while none is. */
  readonly pathDraft: PathDraft | undefined;
  /** The trench being clicked out with the utility tool; nothing while none is. */
  readonly utilityDraft: UtilityRouteDraft | undefined;
  /** The selected trench itself: its run answers thicker, its bends get squares. */
  readonly selectedUtilityRoute: UtilityRoute | undefined;
  readonly selectedShape: Shape | undefined;
  readonly selectedMarkId: MarkId | undefined;
  readonly selectedTreeId: TreeId | undefined;
  /** The selected car itself: its outline is highlighted and its grip is drawn. */
  readonly selectedCar: CarInstance | undefined;
  /** The selected path itself: its ribbon is highlighted and its point handles drawn. */
  readonly selectedPath: SitePath | undefined;
  /** The building taken hold of in view mode; its outline answers in the accent. */
  readonly selectedBuildingId: BuildingId | undefined;
  /** The path handle under or held by the pointer; drawn lit while the rest stay plain. */
  readonly pathHandleHighlight: PathHandleHighlight | undefined;
  /** The point opened on the properties panel inside path editing. */
  readonly selectedPathPointIndex: number | undefined;
  /** The segment whose panel block the pointer rests on; lit over the ribbon. */
  readonly hoveredPathSegmentIndex: number | undefined;
  /** What an open editor is focused on; everything else dims (see modes.md). */
  readonly editFocus: EditTarget | undefined;
  /** The selected wall inside the building editor, with the draft polyline. */
  readonly selectedWall: Wall | undefined;
  /** The junction the break UI is aimed at, with its numbered edges. */
  readonly selectedWallJunction:
    | { readonly position: Vector2; readonly edges: readonly { readonly farPoint: Vector2 }[] }
    | undefined;
  readonly wallDraftPoints: readonly Vector2[];
  /** Where the next wall corner would land, and how far away it is. */
  readonly wallDraftCursor: Vector2 | undefined;
  readonly wallDraftReadout: SegmentReadout | undefined;
  readonly selectedOpeningId: OpeningId | undefined;
  /** The selected piece itself: its grip is drawn ahead of its front. */
  readonly selectedFurniture: FurnitureInstance | undefined;
  /** The stair and the post the editor is aimed at, so the plan lights them. */
  readonly selectedStairId: StairId | undefined;
  readonly selectedSupportId: SupportId | undefined;
  readonly selectedSlabId: ShapeId | undefined;
  readonly selectedFireplaceId: FireplaceId | undefined;
  readonly selectedDuctId: DuctId | undefined;
  readonly selectedEntryId: string | undefined;
  /** Where the selected stair's turn grip stands, in plan metres. */
  readonly selectedStairGrip: Vector2 | undefined;
  readonly selectedDeviceId: DeviceId | undefined;
  /** The first half of a running connect gesture. */
  readonly pendingConnectDeviceId: DeviceId | undefined;
  /** The КОМНАТЫ row the pointer rests on; that room's region lights up. */
  readonly hoveredRoomIndex: number | undefined;
  /** The shape the running gesture is shaping; it stands in for the selection. */
  readonly draftShape: Shape | undefined;
  /** The mark the running gesture is moving; it stands in for its stored self. */
  readonly draftMark: ElevationMark | undefined;
  readonly measurePoints: readonly Vector2[];
  /**
   * The shapes a running gesture is not touching, outlined as skeletons to aim
   * at. Empty whenever nothing is being shaped.
   */
  readonly gestureSkeletonShapes: readonly Shape[];
  /** The key points a Shift-held gesture has joined; nothing while none is. */
  readonly keyPointSnap: KeyPointSnap | undefined;
}

/**
 * The pictures a frame paints but does not own: decoding a data URL and painting
 * a raster are jobs for whoever holds them across frames.
 */
export interface PlanImages {
  readonly overlayImage: AnalysisRasterImage | undefined;
}
