import { isNil } from 'lodash-es';
import { buildVariableWidthRibbon } from '../../../domain/geometry/offset-polygon';
import type { SitePath } from '../../../domain/model/plot-objects';

import { isWallClosed } from '../../../domain/model/walls';
import type { PlanLayerKind } from '../../../domain/view/plan-layers';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { drawCarSelection } from './draw-cars';
import { drawDimensions } from './draw-dimensions';
import { computeFurnitureHandles } from './draw-furniture';
import type { PlanBuilding } from './draw-house';
import { drawBuildingSelection } from './draw-house';
import { drawMeasure } from './draw-measure';
import {
  computePathPointHandles,
  computePolylinePointHandles,
  drawPathPointHandles,
} from './draw-paths';
import { drawHandles, drawSelection } from './draw-selection';
import { drawShapeSkeletons } from './draw-shape-skeletons';
import { drawSnapIndicator } from './draw-snap-indicator';
import { drawJunctionBadges, drawWallDraft } from './draw-wall-chrome';
import type { PlanEditorChrome } from './plan-content';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

/** The editor's own layer over the plan: selections, handles, drafts and snaps — none of it on a printed sheet. */
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

export function drawChrome(
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

  const { selectedWallJunction } = chrome;

  if (!isNil(selectedWallJunction)) {
    drawJunctionBadges(ctx, viewport, selectedWallJunction);
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
