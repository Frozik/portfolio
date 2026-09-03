import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { SegmentReadout } from '../../../domain/geometry/draw-constraints';
import { buildVariableWidthRibbon } from '../../../domain/geometry/offset-polygon';
import type { PathRibbon } from '../../../domain/geometry/path-ribbon';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { DuctId } from '../../../domain/model/ducts';
import type { EditTarget } from '../../../domain/model/editor-mode';
import type { DeviceId } from '../../../domain/model/electrical';
import type { FireplaceId } from '../../../domain/model/fireplaces';
import type { UtilitySystem } from '../../../domain/model/foundation';
import type { FurnitureInstance } from '../../../domain/model/furniture';
import type { OpeningId } from '../../../domain/model/openings';
import type { RoomTypeId } from '../../../domain/model/rooms';
import type { UtilityRoute } from '../../../domain/model/routing';
import type { Shape, ShapeId } from '../../../domain/model/shapes';
import type {
  BuildingId,
  CarInstance,
  ElevationMark,
  MarkId,
  SitePath,
  TreeId,
  TreeInstance,
} from '../../../domain/model/site-plan';

import type { StairId } from '../../../domain/model/stairs';
import type { SupportId } from '../../../domain/model/supports';
import type { Wall } from '../../../domain/model/walls';
import { isWallClosed } from '../../../domain/model/walls';
import type { AnalysisRaster } from '../../../domain/terrain/analysis-raster';
import type { ContourPolyline } from '../../../domain/terrain/contours';
import type { Meters } from '../../../domain/units';
import type { KeyPointSnap } from '../../../domain/view/object-snapping';
import type { PlanLayerKind } from '../../../domain/view/plan-layers';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import type { AnalysisRasterImage } from './draw-analysis-raster';
import { drawAnalysisRaster } from './draw-analysis-raster';
import { drawBoundary } from './draw-boundary';
import { drawCarSelection, drawCars } from './draw-cars';
import { drawCompass } from './draw-compass';
import { drawContours } from './draw-contours';
import { drawDimensions } from './draw-dimensions';
import type { FlowField } from './draw-flow-arrows';
import { drawFlowArrows } from './draw-flow-arrows';
import { computeFurnitureHandles } from './draw-furniture';
import { drawGrid } from './draw-grid';
import type { PlanBuilding } from './draw-house';
import { drawBuildingSelection, drawBuildings } from './draw-house';
import { drawMarks } from './draw-marks';
import { drawMeasure } from './draw-measure';
import type { PathDraft, PathHandleHighlight } from './draw-paths';
import {
  computePathPointHandles,
  computePolylinePointHandles,
  drawPathPointHandles,
  drawPaths,
} from './draw-paths';
import { drawScaleBar } from './draw-scale-bar';
import { drawHandles, drawSelection } from './draw-selection';
import { drawSetback } from './draw-setback';
import { drawShapeSkeletons } from './draw-shape-skeletons';
import { drawSnapIndicator } from './draw-snap-indicator';
import { drawTrees } from './draw-trees';
import type { UtilityRouteDraft } from './draw-utility-routes';
import { drawUtilityRoutes } from './draw-utility-routes';
import { drawWallDraft } from './draw-walls';
import { buildMultiPolygonPath, EDIT_DIM_ALPHA, PLAN_COLORS } from './shared';

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

/**
 * One painting of the plan, from the ground up: backdrop, grid, analysis, the
 * plot and what stands on it, then the editor's own chrome and the corner
 * readouts. The live editor and the exported sheet run this very function —
 * the sheet simply comes without chrome, which is what keeps a printed plan
 * looking like the plan on screen.
 */
export function drawPlan(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    content,
    chrome,
    images,
    labels,
  }: {
    readonly content: PlanContent;
    readonly chrome?: PlanEditorChrome;
    readonly images: PlanImages;
    readonly labels: PlanLabels;
  }
): void {
  const { meterUnit, northLabel, padLabelPrefix } = labels;
  const { analysisRaster, flowField, visibleLayers } = content;
  const { overlayImage } = images;

  ctx.fillStyle = PLAN_COLORS.background;
  ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx);

  if (visibleLayers.has('grid')) {
    drawGrid(ctx, viewport, { baseStepMeters: content.gridStepMeters });
  }

  // Everything read off the terrain is sampled over the plot's bounding box, so
  // it all runs past the plot and is cut back to it by this one path. A plan
  // whose boundary evaluates to nothing therefore carries no terrain reading at
  // all — there is no plot for one to be about, and the 3D view drops the ground
  // on the same rule.
  const plotClipPath = buildMultiPolygonPath(content.boundaryPolygons, viewport);

  // The analysis colours the ground the plot is drawn on, so it goes over the
  // grid and under everything the plan is actually made of.
  if (visibleLayers.has('analysis')) {
    if (!isNil(analysisRaster) && !isNil(overlayImage)) {
      drawAnalysisRaster(ctx, viewport, { raster: analysisRaster, image: overlayImage });
    }

    if (!isNil(flowField)) {
      // The arrows already stand on covered samples only; the clip is what keeps
      // the one drawn on the last of them from reaching over the boundary.
      ctx.save();
      ctx.clip(plotClipPath);
      drawFlowArrows(ctx, viewport, flowField);
      ctx.restore();
    }
  }

  if (visibleLayers.has('contours')) {
    drawContours(ctx, viewport, { contours: content.contours, meterUnit, plotClipPath });
  }

  if (visibleLayers.has('setback')) {
    drawSetback(ctx, viewport, content.setbackRings);
  }

  // Everything an open editor is NOT editing steps back to this opacity —
  // present as context, visibly out of reach (see modes.md).
  const editFocus = chrome?.editFocus;
  const dimmed = (isDimmed: boolean, draw: () => void): void => {
    if (!isDimmed) {
      draw();

      return;
    }

    ctx.save();
    ctx.globalAlpha = EDIT_DIM_ALPHA;
    draw();
    ctx.restore();
  };
  const isPathFocus = editFocus?.kind === 'path';
  const isSiteFocus = editFocus?.kind === 'site';
  const isBuildingFocus = editFocus?.kind === 'building';
  const isRouteFocus = editFocus?.kind === 'utilityRoute';

  dimmed(isPathFocus || isBuildingFocus || isRouteFocus, () =>
    drawBoundary(ctx, viewport, content.boundaryPolygons)
  );

  // Paving lies on the ground and the house stands over it, so the ribbons go
  // under the footprint and the crowns over everything.
  if (visibleLayers.has('paths')) {
    dimmed(isSiteFocus || isPathFocus || isBuildingFocus || isRouteFocus, () =>
      drawPaths(ctx, viewport, {
        ribbons: content.pathRibbons,
        selectedPathId: chrome?.selectedPath?.id,
        draft: chrome?.pathDraft,
      })
    );

    // The edited path alone comes back at full opacity, over the dimmed rest.
    if (isPathFocus) {
      const focusedRibbon = content.pathRibbons.find(ribbon => ribbon.id === editFocus.pathId);

      if (!isNil(focusedRibbon)) {
        drawPaths(ctx, viewport, {
          ribbons: [focusedRibbon],
          selectedPathId: focusedRibbon.id,
          draft: undefined,
        });
      }
    }
  }

  dimmed(isPathFocus || isRouteFocus, () =>
    drawBuildings(ctx, viewport, {
      buildings: content.buildings,
      selectedBuildingId: chrome?.selectedBuildingId,
      padLabelPrefix,
      meterUnit,
      entryLetters: labels.entryLetters,
      focusBuildingId: editFocus?.kind === 'building' ? editFocus.buildingId : undefined,
      selectedWallId: chrome?.selectedWall?.id,
      selectedOpeningId: chrome?.selectedOpeningId,
      selectedFurnitureId: chrome?.selectedFurniture?.id,
      selectedStairId: chrome?.selectedStairId,
      selectedSupportId: chrome?.selectedSupportId,
      selectedSlabId: chrome?.selectedSlabId,
      selectedFireplaceId: chrome?.selectedFireplaceId,
      selectedDuctId: chrome?.selectedDuctId,
      selectedEntryId: chrome?.selectedEntryId,
      selectedDeviceId: chrome?.selectedDeviceId,
      pendingConnectDeviceId: chrome?.pendingConnectDeviceId,
      hoveredRoomIndex: chrome?.hoveredRoomIndex,
      roomTypeNames: labels.roomTypeNames,
      squareMeterUnit: labels.squareMeterUnit,
      stairUpLabel: labels.stairUp,
    })
  );

  // Trenches are survey linework: they read over the footprints they serve, the
  // way an engineering plan overlays its networks on the buildings.
  dimmed(isSiteFocus || isPathFocus || isBuildingFocus || isRouteFocus, () =>
    drawUtilityRoutes(ctx, viewport, {
      routes: content.utilityRoutes,
      selectedRouteId: chrome?.selectedUtilityRoute?.id,
      draft: chrome?.utilityDraft,
      entryLetters: labels.entryLetters,
    })
  );

  // The edited trench alone comes back at full opacity, over the dimmed rest.
  if (isRouteFocus) {
    const focusedRoute = content.utilityRoutes.find(route => route.id === editFocus.routeId);

    if (!isNil(focusedRoute)) {
      drawUtilityRoutes(ctx, viewport, {
        routes: [focusedRoute],
        selectedRouteId: focusedRoute.id,
        draft: undefined,
        entryLetters: labels.entryLetters,
      });
    }
  }

  // A car stands on the paving and under the crowns, the way it does on the plot.
  dimmed(isSiteFocus || isPathFocus || isBuildingFocus || isRouteFocus, () =>
    drawCars(ctx, viewport, { cars: content.cars, selectedCarId: chrome?.selectedCar?.id })
  );

  if (visibleLayers.has('trees')) {
    dimmed(isSiteFocus || isPathFocus || isBuildingFocus || isRouteFocus, () =>
      drawTrees(ctx, viewport, { trees: content.trees, selectedTreeId: chrome?.selectedTreeId })
    );
  }

  if (visibleLayers.has('marks')) {
    dimmed(isPathFocus || isBuildingFocus || isRouteFocus, () =>
      drawMarks(ctx, viewport, {
        marks: content.elevationMarks,
        draftMark: chrome?.draftMark,
        selectedMarkId: chrome?.selectedMarkId,
        meterUnit,
      })
    );
  }

  if (!isNil(chrome)) {
    drawChrome(ctx, viewport, { chrome, buildings: content.buildings, visibleLayers, meterUnit });
  }

  drawCompass(ctx, viewport, { northOffsetDegrees: content.northOffsetDegrees, northLabel });
  drawScaleBar(ctx, viewport, { meterUnit });
}

/** How the panel's hovered segment answers on the sheet: its ribbon, lit. */
const HOVERED_SEGMENT_FILL = 'rgba(96, 165, 250, 0.28)';
const HOVERED_SEGMENT_LINE_WIDTH_PX = 2;

function drawHoveredPathSegment(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  path: SitePath,
  segmentIndex: number | undefined
): void {
  if (isNil(segmentIndex)) {
    return;
  }

  const points = path.points.slice(segmentIndex, segmentIndex + 2);

  if (points.length < 2) {
    return;
  }

  const outline = buildMultiPolygonPath(buildVariableWidthRibbon(points), viewport);

  ctx.save();
  ctx.fillStyle = HOVERED_SEGMENT_FILL;
  ctx.fill(outline, 'nonzero');
  ctx.strokeStyle = PLAN_COLORS.boundaryStroke;
  ctx.lineWidth = HOVERED_SEGMENT_LINE_WIDTH_PX;
  ctx.lineJoin = 'round';
  ctx.stroke(outline);
  ctx.restore();
}

function drawChrome(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    chrome,
    buildings,
    visibleLayers,
    meterUnit,
  }: {
    readonly chrome: PlanEditorChrome;
    readonly buildings: readonly PlanBuilding[];
    readonly visibleLayers: ReadonlySet<PlanLayerKind>;
    readonly meterUnit: string;
  }
): void {
  // Under the rest of the chrome: a gesture aims against them, it shapes none of them.
  drawShapeSkeletons(ctx, viewport, chrome.gestureSkeletonShapes);
  drawMeasure(ctx, viewport, { points: chrome.measurePoints, meterUnit });

  // A draft is the live preview of the running gesture; the plot itself only
  // catches up once the edit lands, so the draft is what carries the chrome.
  const shapeInFocus = chrome.draftShape ?? chrome.selectedShape;

  if (!isNil(shapeInFocus)) {
    drawSelection(ctx, viewport, shapeInFocus);

    if (visibleLayers.has('dimensions')) {
      drawDimensions(ctx, viewport, { shape: shapeInFocus, meterUnit });
    }
  }

  const { selectedCar } = chrome;

  if (!isNil(selectedCar)) {
    drawCarSelection(ctx, viewport, selectedCar);
  }

  // The whole-building turn grip belongs to VIEW mode alone: inside an editor
  // the building is worked on, not arranged, and the grip would fight tools.
  if (isNil(chrome.editFocus) && !isNil(chrome.selectedBuildingId)) {
    const selectedBuilding = buildings.find(building => building.id === chrome.selectedBuildingId);

    if (!isNil(selectedBuilding)) {
      drawBuildingSelection(ctx, viewport, selectedBuilding.polygons);
    }
  }

  const { selectedPath } = chrome;

  if (!isNil(selectedPath) && visibleLayers.has('paths')) {
    drawHoveredPathSegment(ctx, viewport, selectedPath, chrome.hoveredPathSegmentIndex);
    drawPathPointHandles(
      ctx,
      computePathPointHandles(selectedPath, viewport, {
        includeMidpoints: chrome.editFocus?.kind === 'path',
      }),
      chrome.pathHandleHighlight,
      chrome.selectedPathPointIndex
    );
  }

  const { selectedUtilityRoute } = chrome;

  if (!isNil(selectedUtilityRoute)) {
    drawPathPointHandles(
      ctx,
      computePolylinePointHandles(selectedUtilityRoute.points, viewport, {
        includeMidpoints: chrome.editFocus?.kind === 'utilityRoute',
      }),
      chrome.pathHandleHighlight,
      undefined
    );
  }

  const { selectedWall } = chrome;

  if (!isNil(selectedWall)) {
    drawPathPointHandles(
      ctx,
      computePolylinePointHandles(selectedWall.points, viewport, {
        includeMidpoints: true,
        isClosed: isWallClosed(selectedWall),
      }),
      chrome.pathHandleHighlight,
      undefined
    );
  }

  const { selectedFurniture } = chrome;

  if (!isNil(selectedFurniture)) {
    drawHandles(ctx, computeFurnitureHandles(selectedFurniture, viewport));
  }

  const { selectedStairGrip } = chrome;

  if (!isNil(selectedStairGrip)) {
    drawHandles(ctx, [{ kind: 'rotate', screenPoint: planToScreen(viewport, selectedStairGrip) }]);
  }

  drawWallDraft(ctx, viewport, chrome.wallDraftPoints, {
    cursor: chrome.wallDraftCursor,
    readout: chrome.wallDraftReadout,
    meterUnit,
  });

  const { keyPointSnap } = chrome;

  if (!isNil(keyPointSnap)) {
    drawSnapIndicator(ctx, viewport, keyPointSnap);
  }
}
