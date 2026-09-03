import { chooseNiceStepAtMost } from '../../../domain/geometry/nice-step';
import type { Meters } from '../../../domain/units';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import {
  formatMeters,
  PLAN_CHROME_PADDING_PX,
  PLAN_COLORS,
  PLAN_LABEL_FONT_SIZE_PX,
  planMonoFont,
  SCALE_BAR_BLOCK_HEIGHT_PX,
  SCALE_BAR_LABEL_GAP_PX,
  SCALE_BAR_TICK_HEIGHT_PX,
} from './shared';

/** Widest the bar is allowed to grow before the next round step is chosen. */
const SCALE_BAR_TARGET_WIDTH_PX = 140;
const SCALE_BAR_LINE_WIDTH_PX = 1;

export interface ScaleBarStyle {
  readonly strokeColor: string;
  readonly textColor: string;
}

const DEFAULT_SCALE_BAR_STYLE: ScaleBarStyle = {
  strokeColor: PLAN_COLORS.chromeStroke,
  textColor: PLAN_COLORS.textStrong,
};

/**
 * Bottom-left ruler spanning a round 1 / 2 / 5 · 10ⁿ number of metres — the
 * printed plan's only absolute reference once the zoom is arbitrary.
 */
export function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  { meterUnit }: { readonly meterUnit: string },
  style: ScaleBarStyle = DEFAULT_SCALE_BAR_STYLE
): void {
  if (viewport.pixelsPerMeter <= 0) {
    return;
  }

  const spanMeters: Meters = chooseNiceStepAtMost(
    SCALE_BAR_TARGET_WIDTH_PX / viewport.pixelsPerMeter
  );
  const spanPx = spanMeters * viewport.pixelsPerMeter;

  const blockTop = viewport.heightPx - PLAN_CHROME_PADDING_PX - SCALE_BAR_BLOCK_HEIGHT_PX;
  const baselineY = blockTop + SCALE_BAR_TICK_HEIGHT_PX;
  const left = PLAN_CHROME_PADDING_PX;
  const right = left + spanPx;

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = SCALE_BAR_LINE_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(left, baselineY);
  ctx.lineTo(right, baselineY);
  ctx.moveTo(left, blockTop);
  ctx.lineTo(left, baselineY);
  ctx.moveTo(right, blockTop);
  ctx.lineTo(right, baselineY);
  ctx.stroke();

  ctx.fillStyle = style.textColor;
  ctx.font = planMonoFont(PLAN_LABEL_FONT_SIZE_PX);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    formatMeters(spanMeters, meterUnit, countScaleFractionDigits(spanMeters)),
    left,
    baselineY + SCALE_BAR_LABEL_GAP_PX
  );
  ctx.restore();
}

/**
 * A ruler reads better as `10 m` than as `10.00 m`, but a sub-metre span must
 * not be rounded away to `1 m` — so the span itself decides the precision.
 */
function countScaleFractionDigits(spanMeters: Meters): number {
  return Math.max(0, -Math.floor(Math.log10(spanMeters)));
}
