import { isNil } from 'lodash-es';

import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { drawAnalysisRaster } from './draw-analysis-raster';
import { drawBoundary } from './draw-boundary';
import { drawCars } from './draw-cars';
import { drawChrome } from './draw-chrome';
import { drawCompass } from './draw-compass';
import { drawContours } from './draw-contours';
import { drawFlowArrows } from './draw-flow-arrows';
import { drawGrid } from './draw-grid';
import { drawBuildings } from './draw-house';
import { drawMarks } from './draw-marks';
import { drawPaths } from './draw-paths';
import { drawScaleBar } from './draw-scale-bar';
import { drawSetback } from './draw-setback';
import { drawTrees } from './draw-trees';
import { drawUtilityRoutes } from './draw-utility-routes';
import type { PlanContent, PlanEditorChrome, PlanImages, PlanLabels } from './plan-content';
import { buildMultiPolygonPath, EDIT_DIM_ALPHA, PLAN_COLORS } from './shared';

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
