import type { Vector2 } from '@frozik/utils/math/vector2';

import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { drawLabel, formatMeters, PLAN_COLORS } from './shared';

const MEASURE_LINE_WIDTH_PX = 1.5;
const MEASURE_END_RADIUS_PX = 3;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;
const POINTS_PER_MEASUREMENT = 2;

export interface MeasureStyle {
  readonly strokeColor: string;
  readonly textColor: string;
}

const DEFAULT_MEASURE_STYLE: MeasureStyle = {
  strokeColor: PLAN_COLORS.measureStroke,
  textColor: PLAN_COLORS.textStrong,
};

/**
 * Ad-hoc point-to-point measurements. Points arrive as consecutive pairs; a
 * trailing odd point is a measurement the user has started and shows as a lone
 * anchor until its second click lands.
 */
export function drawMeasure(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  { points, meterUnit }: { readonly points: readonly Vector2[]; readonly meterUnit: string },
  style: MeasureStyle = DEFAULT_MEASURE_STYLE
): void {
  if (points.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.fillStyle = style.strokeColor;
  ctx.lineWidth = MEASURE_LINE_WIDTH_PX;

  for (let index = 0; index < points.length; index += POINTS_PER_MEASUREMENT) {
    const start = points[index];
    const end = points[index + 1];
    const startScreen = planToScreen(viewport, start);

    drawAnchor(ctx, startScreen);

    if (end === undefined) {
      continue;
    }

    const endScreen = planToScreen(viewport, end);

    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    drawAnchor(ctx, endScreen);

    drawLabel(
      ctx,
      formatMeters(Math.hypot(end.x - start.x, end.y - start.y), meterUnit),
      { x: (startScreen.x + endScreen.x) / 2, y: (startScreen.y + endScreen.y) / 2 },
      style.textColor
    );
  }

  ctx.restore();
}

function drawAnchor(ctx: CanvasRenderingContext2D, screenPoint: Vector2): void {
  ctx.beginPath();
  ctx.arc(screenPoint.x, screenPoint.y, MEASURE_END_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.fill();
}
