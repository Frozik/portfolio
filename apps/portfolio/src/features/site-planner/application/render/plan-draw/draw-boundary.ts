import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

const BOUNDARY_LINE_WIDTH_PX = 2;

export interface BoundaryStyle {
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly lineWidthPx: number;
}

const DEFAULT_BOUNDARY_STYLE: BoundaryStyle = {
  fillColor: PLAN_COLORS.boundaryFill,
  strokeColor: PLAN_COLORS.boundaryStroke,
  lineWidthPx: BOUNDARY_LINE_WIDTH_PX,
};

/**
 * Paints the evaluated plot: the boolean fold has already been applied, so the
 * subtracted terms exist here only as holes in the result and are never drawn
 * as shapes of their own.
 */
export function drawBoundary(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  polygons: MultiPolygon,
  style: BoundaryStyle = DEFAULT_BOUNDARY_STYLE
): void {
  if (polygons.length === 0) {
    return;
  }

  const path = buildMultiPolygonPath(polygons, viewport);

  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.fill(path, 'nonzero');
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidthPx;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  ctx.restore();
}
