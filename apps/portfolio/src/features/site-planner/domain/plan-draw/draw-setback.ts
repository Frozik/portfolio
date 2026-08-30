import type { MultiPolygon } from '../geometry/polygon-types';
import type { PlanViewport } from '../view/plan-viewport';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

const SETBACK_LINE_WIDTH_PX = 1;
/** Dashes against the solid boundary — the drawing convention for a setback line. */
const SETBACK_DASH_PATTERN_PX: readonly number[] = [6, 5];

export interface SetbackStyle {
  readonly strokeColor: string;
  readonly lineWidthPx: number;
  readonly dashPatternPx: readonly number[];
}

const DEFAULT_SETBACK_STYLE: SetbackStyle = {
  strokeColor: PLAN_COLORS.setbackStroke,
  lineWidthPx: SETBACK_LINE_WIDTH_PX,
  dashPatternPx: SETBACK_DASH_PATTERN_PX,
};

/** Strokes the inward offset of the plot; the enclosed area stays unfilled. */
export function drawSetback(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  polygons: MultiPolygon,
  style: SetbackStyle = DEFAULT_SETBACK_STYLE
): void {
  if (polygons.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidthPx;
  ctx.setLineDash([...style.dashPatternPx]);
  ctx.stroke(buildMultiPolygonPath(polygons, viewport));
  ctx.restore();
}
