import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';
import { isNil } from 'lodash-es';

import { computeMultiPolygonBounds } from '../../../domain/geometry/bounding-box';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import type { ShapeHandle } from './draw-selection';
import { drawHandles, ROTATION_HANDLE_GAP_PX } from './draw-selection';

/**
 * The turn grip of a selected building: hanging over the footprint's top edge
 * the way the car's hangs past its nose, so a whole house can be turned in
 * view mode — contents, roof ridge and all.
 */
export function computeBuildingHandles(
  polygons: MultiPolygon,
  viewport: PlanViewport
): readonly ShapeHandle[] {
  const bounds = computeMultiPolygonBounds(polygons);

  if (isNil(bounds)) {
    return [];
  }

  const topCentre = planToScreen(viewport, {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.maxY,
  });

  return [
    {
      kind: 'rotate',
      screenPoint: { x: topCentre.x, y: topCentre.y - ROTATION_HANDLE_GAP_PX },
    },
  ];
}

export function drawBuildingSelection(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  polygons: MultiPolygon
): void {
  drawHandles(ctx, computeBuildingHandles(polygons, viewport));
}
