import type { Vector2 } from '@frozik/utils/math/vector2';

import { DEGREES_TO_RADIANS } from '../../../domain/units';
import { northNeedleAngleDegrees } from '../../../domain/view/north-offset';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import {
  COMPASS_RADIUS_PX,
  PLAN_CHROME_PADDING_PX,
  PLAN_CHROME_ROW_GAP_PX,
  PLAN_COLORS,
  PLAN_LABEL_FONT_SIZE_PX,
  planMonoFont,
  SCALE_BAR_BLOCK_HEIGHT_PX,
} from './shared';

const COMPASS_LINE_WIDTH_PX = 1;
const NEEDLE_HALF_WIDTH_PX = 4;
const NEEDLE_LENGTH_PX = COMPASS_RADIUS_PX - 3;
const LABEL_GAP_PX = 5;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

export interface CompassStyle {
  readonly ringColor: string;
  readonly needleColor: string;
  readonly textColor: string;
}

const DEFAULT_COMPASS_STYLE: CompassStyle = {
  ringColor: PLAN_COLORS.chromeStroke,
  needleColor: PLAN_COLORS.boundaryStroke,
  textColor: PLAN_COLORS.textStrong,
};

/**
 * North indicator in the bottom-left corner, stacked above the scale bar. It
 * shows the plot's north offset the way `view/north-offset.ts` defines it, and
 * it is what makes the sun study interpretable on the plan.
 */
export function drawCompass(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    northOffsetDegrees,
    northLabel,
  }: { readonly northOffsetDegrees: number; readonly northLabel: string },
  style: CompassStyle = DEFAULT_COMPASS_STYLE
): void {
  const center: Vector2 = {
    x: PLAN_CHROME_PADDING_PX + COMPASS_RADIUS_PX,
    y:
      viewport.heightPx -
      PLAN_CHROME_PADDING_PX -
      SCALE_BAR_BLOCK_HEIGHT_PX -
      PLAN_CHROME_ROW_GAP_PX -
      COMPASS_RADIUS_PX,
  };

  const angle = northNeedleAngleDegrees(northOffsetDegrees) * DEGREES_TO_RADIANS;
  const needle: Vector2 = { x: Math.sin(angle), y: -Math.cos(angle) };
  const across: Vector2 = { x: -needle.y, y: needle.x };

  ctx.save();
  ctx.lineWidth = COMPASS_LINE_WIDTH_PX;
  ctx.strokeStyle = style.ringColor;
  ctx.beginPath();
  ctx.arc(center.x, center.y, COMPASS_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.stroke();

  ctx.fillStyle = style.needleColor;
  ctx.beginPath();
  ctx.moveTo(center.x + needle.x * NEEDLE_LENGTH_PX, center.y + needle.y * NEEDLE_LENGTH_PX);
  ctx.lineTo(
    center.x + across.x * NEEDLE_HALF_WIDTH_PX,
    center.y + across.y * NEEDLE_HALF_WIDTH_PX
  );
  ctx.lineTo(
    center.x - across.x * NEEDLE_HALF_WIDTH_PX,
    center.y - across.y * NEEDLE_HALF_WIDTH_PX
  );
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = style.textColor;
  ctx.font = planMonoFont(PLAN_LABEL_FONT_SIZE_PX);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    northLabel,
    center.x + needle.x * (COMPASS_RADIUS_PX + LABEL_GAP_PX),
    center.y + needle.y * (COMPASS_RADIUS_PX + LABEL_GAP_PX)
  );
  ctx.restore();
}
