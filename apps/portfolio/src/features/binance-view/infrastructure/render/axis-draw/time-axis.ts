import type { IAxisRect } from '../../../domain/axis-scale';
import { formatTimeLabel, pickTimeStepMs } from '../../../domain/axis-scale';
import { AXIS_FONT_SIZE, AXIS_LABEL_COLOR, AXIS_LINE_COLOR } from '../../../domain/constants';

import type { IAxisDrawInput } from './shared';
import { LABEL_PADDING_X, LABEL_PADDING_Y } from './shared';

const TICK_LENGTH_PX = 4;
const LABEL_BACKGROUND = 'rgba(26, 26, 26, 0.85)';

interface ITimeTicks {
  readonly stepMs: number;
  readonly firstTickMs: number;
  readonly widthPx: number;
  readonly rangeMs: number;
}

function resolveTimeTicks(rect: IAxisRect, input: IAxisDrawInput): ITimeTicks | undefined {
  const widthPx = rect.right - rect.left;
  const rangeMs = input.viewTimeEndMs - input.viewTimeStartMs;
  if (rangeMs <= 0 || widthPx <= 0) {
    return undefined;
  }
  const stepMs = pickTimeStepMs(rangeMs, widthPx);
  const firstTickMs = Math.ceil(input.viewTimeStartMs / stepMs) * stepMs;
  return { stepMs, firstTickMs, widthPx, rangeMs };
}

function tickX(rect: IAxisRect, ticks: ITimeTicks, tickMs: number, startMs: number): number {
  return rect.left + ((tickMs - startMs) / ticks.rangeMs) * ticks.widthPx;
}

/**
 * Axis line at the bottom of the price area (doubling as the divider above
 * the volume panel), tick marks and labels along the bottom of the canvas.
 */
export function drawTimeAxisLabels(
  ctx: CanvasRenderingContext2D,
  rect: IAxisRect,
  labelRect: IAxisRect,
  input: IAxisDrawInput
): void {
  const ticks = resolveTimeTicks(rect, input);
  if (ticks === undefined) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(rect.left, rect.bottom);
  ctx.lineTo(rect.right, rect.bottom);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const labelY = labelRect.bottom - TICK_LENGTH_PX - LABEL_PADDING_Y;

  for (let tick = ticks.firstTickMs; tick <= input.viewTimeEndMs; tick += ticks.stepMs) {
    const x = tickX(rect, ticks, tick, input.viewTimeStartMs);

    ctx.strokeStyle = AXIS_LINE_COLOR;
    ctx.beginPath();
    ctx.moveTo(x, labelRect.bottom);
    ctx.lineTo(x, labelRect.bottom - TICK_LENGTH_PX);
    ctx.stroke();

    const label = formatTimeLabel(tick);
    const metrics = ctx.measureText(label);
    ctx.fillStyle = LABEL_BACKGROUND;
    ctx.fillRect(
      x - metrics.width / 2 - LABEL_PADDING_X,
      labelY - AXIS_FONT_SIZE - LABEL_PADDING_Y,
      metrics.width + 2 * LABEL_PADDING_X,
      AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y
    );
    ctx.fillStyle = AXIS_LABEL_COLOR;
    ctx.fillText(label, x, labelY);
  }
}
