import { Temporal } from 'temporal-polyfill';

import { AXIS_FONT_SIZE, AXIS_LABEL_COLOR, AXIS_LINE_COLOR } from '../constants';

import type { IAxisDrawInput, IAxisRect } from './shared';
import { LABEL_PADDING_X, LABEL_PADDING_Y } from './shared';

const MINUTE_MS = 60 * 1000;
const MINUTE_GRID_LINE_WIDTH_PX = 3;
const DEFAULT_GRID_LINE_WIDTH_PX = 1;
const TICK_LENGTH_PX = 4;
const MIN_X_TICK_SPACING_PX = 80;
const MIN_TARGET_TICKS = 2;
const TIME_PAD = 2;
const LABEL_BACKGROUND = 'rgba(26, 26, 26, 0.85)';

const TIME_STEP_CANDIDATES_MS = [
  1000,
  2 * 1000,
  5 * 1000,
  10 * 1000,
  15 * 1000,
  30 * 1000,
  60 * 1000,
  2 * 60 * 1000,
  5 * 60 * 1000,
  10 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
];

function pickTimeStepMs(rangeMs: number, plotWidthPx: number): number {
  const maxTicks = Math.max(MIN_TARGET_TICKS, Math.floor(plotWidthPx / MIN_X_TICK_SPACING_PX));
  const rawStep = rangeMs / maxTicks;
  for (const candidate of TIME_STEP_CANDIDATES_MS) {
    if (candidate >= rawStep) {
      return candidate;
    }
  }
  return TIME_STEP_CANDIDATES_MS[TIME_STEP_CANDIDATES_MS.length - 1];
}

export function formatTimeLabel(timestampMs: number): string {
  const time = Temporal.Instant.fromEpochMilliseconds(timestampMs)
    .toZonedDateTimeISO('UTC')
    .toPlainTime();
  const hours = time.hour.toString().padStart(TIME_PAD, '0');
  const minutes = time.minute.toString().padStart(TIME_PAD, '0');
  const seconds = time.second.toString().padStart(TIME_PAD, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function drawTimeGrid(
  ctx: CanvasRenderingContext2D,
  rect: IAxisRect,
  input: IAxisDrawInput
): void {
  const { viewTimeStartMs, viewTimeEndMs } = input;
  const widthPx = rect.right - rect.left;
  const rangeMs = viewTimeEndMs - viewTimeStartMs;
  if (rangeMs <= 0 || widthPx <= 0) {
    return;
  }

  const stepMs = pickTimeStepMs(rangeMs, widthPx);
  const firstTick = Math.ceil(viewTimeStartMs / stepMs) * stepMs;

  for (let tick = firstTick; tick <= viewTimeEndMs; tick += stepMs) {
    const normalized = (tick - viewTimeStartMs) / rangeMs;
    const x = rect.left + normalized * widthPx;
    ctx.lineWidth = tick % MINUTE_MS === 0 ? MINUTE_GRID_LINE_WIDTH_PX : DEFAULT_GRID_LINE_WIDTH_PX;
    ctx.beginPath();
    ctx.moveTo(x, rect.top);
    ctx.lineTo(x, rect.bottom);
    ctx.stroke();
  }
  ctx.lineWidth = DEFAULT_GRID_LINE_WIDTH_PX;
}

export function drawTimeAxisLabels(
  ctx: CanvasRenderingContext2D,
  rect: IAxisRect,
  input: IAxisDrawInput
): void {
  const { viewTimeStartMs, viewTimeEndMs } = input;
  const widthPx = rect.right - rect.left;
  const rangeMs = viewTimeEndMs - viewTimeStartMs;
  if (rangeMs <= 0 || widthPx <= 0) {
    return;
  }

  // X axis line spans the plot area only; the Y-axis panel renders
  // its own left border in `drawYAxisPanel`.
  ctx.beginPath();
  ctx.moveTo(rect.left, rect.bottom);
  ctx.lineTo(rect.right, rect.bottom);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const stepMs = pickTimeStepMs(rangeMs, widthPx);
  const firstTick = Math.ceil(viewTimeStartMs / stepMs) * stepMs;
  const labelY = rect.bottom - TICK_LENGTH_PX - LABEL_PADDING_Y;

  for (let tick = firstTick; tick <= viewTimeEndMs; tick += stepMs) {
    const normalized = (tick - viewTimeStartMs) / rangeMs;
    const x = rect.left + normalized * widthPx;

    ctx.strokeStyle = AXIS_LINE_COLOR;
    ctx.beginPath();
    ctx.moveTo(x, rect.bottom);
    ctx.lineTo(x, rect.bottom - TICK_LENGTH_PX);
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
