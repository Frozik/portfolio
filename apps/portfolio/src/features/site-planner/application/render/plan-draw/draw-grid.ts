import type { Vector2 } from '@frozik/utils/math/vector2';
import { chooseNiceStepAtLeast } from '../../../domain/geometry/nice-step';
import type { Meters } from '../../../domain/units';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen, screenToPlan } from '../../../domain/view/plan-viewport';
import { PLAN_COLORS } from './shared';

/** Below this the grid reads as a haze rather than as a measurable rule. */
const MIN_MINOR_SPACING_PX = 14;
const MAJOR_EVERY_MINOR_LINES = 5;
const LINE_WIDTH_PX = 1;
/** Odd-width strokes land on a pixel boundary when offset by half a pixel. */
const HALF_PIXEL = 0.5;

export interface GridStyle {
  readonly minorColor: string;
  readonly majorColor: string;
}

const DEFAULT_GRID_STYLE: GridStyle = {
  minorColor: PLAN_COLORS.gridMinor,
  majorColor: PLAN_COLORS.gridMajor,
};

/**
 * Metric grid whose spacing adapts to the zoom: the minor step is the coarser
 * of the plan's own grid step and the smallest 1/2/5 step that still keeps
 * lines {@link MIN_MINOR_SPACING_PX} apart, and every fifth line is emphasised.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  { baseStepMeters }: { readonly baseStepMeters: Meters },
  style: GridStyle = DEFAULT_GRID_STYLE
): void {
  if (viewport.widthPx <= 0 || viewport.heightPx <= 0 || viewport.pixelsPerMeter <= 0) {
    return;
  }

  const readableStep = chooseNiceStepAtLeast(MIN_MINOR_SPACING_PX / viewport.pixelsPerMeter);
  const minorStep = Math.max(baseStepMeters > 0 ? baseStepMeters : readableStep, readableStep);
  const majorStep = minorStep * MAJOR_EVERY_MINOR_LINES;

  const topLeft = screenToPlan(viewport, { x: 0, y: 0 });
  const bottomRight = screenToPlan(viewport, { x: viewport.widthPx, y: viewport.heightPx });

  ctx.save();
  ctx.lineWidth = LINE_WIDTH_PX;

  drawLines(ctx, viewport, topLeft, bottomRight, minorStep, style.minorColor);
  drawLines(ctx, viewport, topLeft, bottomRight, majorStep, style.majorColor);

  ctx.restore();
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  topLeft: Vector2,
  bottomRight: Vector2,
  stepMeters: Meters,
  color: string
): void {
  const path = new Path2D();

  const firstX = Math.ceil(topLeft.x / stepMeters) * stepMeters;

  for (let planX = firstX; planX <= bottomRight.x; planX += stepMeters) {
    const screenX = Math.round(planToScreen(viewport, { x: planX, y: 0 }).x) + HALF_PIXEL;

    path.moveTo(screenX, 0);
    path.lineTo(screenX, viewport.heightPx);
  }

  const firstY = Math.ceil(bottomRight.y / stepMeters) * stepMeters;

  for (let planY = firstY; planY <= topLeft.y; planY += stepMeters) {
    const screenY = Math.round(planToScreen(viewport, { x: 0, y: planY }).y) + HALF_PIXEL;

    path.moveTo(0, screenY);
    path.lineTo(viewport.widthPx, screenY);
  }

  ctx.strokeStyle = color;
  ctx.stroke(path);
}
