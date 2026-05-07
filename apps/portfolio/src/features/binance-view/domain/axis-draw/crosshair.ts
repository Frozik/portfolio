import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  CROSSHAIR_LABEL_BG_COLOR,
  CROSSHAIR_LABEL_FG_COLOR,
  CROSSHAIR_LINE_COLOR,
  CROSSHAIR_LINE_DASH,
} from '../constants';

import { fractionDigitsFor, PRICE_DEFAULT_FRACTION_DIGITS } from './price-axis';
import type { IAxisDrawInput, IAxisRect } from './shared';
import { LABEL_PADDING_X, LABEL_PADDING_Y } from './shared';
import { formatTimeLabel } from './time-axis';

const SECOND_MS = 1000;

/**
 * Bookmap-style crosshair: vertical + horizontal dashed lines anchored
 * to the cursor, with a time label box pinned to the X axis and a
 * price label box painted inside the Y-axis panel. The labels use a
 * contrasting background + foreground so they pop against the chart
 * regardless of the heatmap colour underneath.
 *
 * The time is snapped down to the nearest whole second, matching the
 * snapshot cadence — showing sub-second precision here would be
 * misleading since the underlying data is quantised at 1 Hz.
 *
 * The vertical line + time label are skipped when the cursor is in
 * the Y-axis panel (pointer.x > plotRect.right), but the horizontal
 * line + price label still render so the user can read a price for
 * any vertical position they want to inspect.
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  plotRect: IAxisRect,
  yAxisRect: IAxisRect,
  input: IAxisDrawInput
): void {
  const { cursorCss, viewTimeStartMs, viewTimeEndMs, priceMin, priceMax, priceStep } = input;
  if (cursorCss === undefined) {
    return;
  }
  const plotWidth = plotRect.right - plotRect.left;
  const plotHeight = plotRect.bottom - plotRect.top;
  const rangeMs = viewTimeEndMs - viewTimeStartMs;
  const priceRange = priceMax - priceMin;
  if (plotWidth <= 0 || plotHeight <= 0 || rangeMs <= 0 || priceRange <= 0) {
    return;
  }
  // Ignore cursors that fell off the vertical axis — the bottom edge
  // hosts the X-axis line, beyond that there's nothing meaningful.
  if (cursorCss.y < plotRect.top || cursorCss.y > plotRect.bottom) {
    return;
  }

  const isCursorInPlotX = cursorCss.x >= plotRect.left && cursorCss.x <= plotRect.right;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CROSSHAIR_LINE_COLOR;
  ctx.setLineDash([...CROSSHAIR_LINE_DASH]);

  // Horizontal line stops at the Y-axis panel's left border — the
  // panel then hosts the price label inside its own rectangle, so the
  // line leading into the label reads as "this cursor Y → that price".
  ctx.beginPath();
  ctx.moveTo(plotRect.left, cursorCss.y);
  ctx.lineTo(yAxisRect.left, cursorCss.y);
  ctx.stroke();

  if (isCursorInPlotX) {
    ctx.beginPath();
    ctx.moveTo(cursorCss.x, plotRect.top);
    ctx.lineTo(cursorCss.x, plotRect.bottom);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.font = `${AXIS_FONT_SIZE}px ${AXIS_FONT_FAMILY}`;

  if (isCursorInPlotX) {
    const timeAtCursor = viewTimeStartMs + ((cursorCss.x - plotRect.left) / plotWidth) * rangeMs;
    // Snap to 1-second precision — the data itself is quantised at 1 Hz,
    // so sub-second precision in the label would be fictional.
    const snappedSec = Math.floor(timeAtCursor / SECOND_MS) * SECOND_MS;
    drawCrosshairTimeLabel(ctx, plotRect, cursorCss.x, formatTimeLabel(snappedSec));
  }

  const priceAtCursor = priceMax - ((cursorCss.y - plotRect.top) / plotHeight) * priceRange;
  const fraction = Math.max(PRICE_DEFAULT_FRACTION_DIGITS, fractionDigitsFor(priceStep));
  drawCrosshairPriceLabel(ctx, yAxisRect, cursorCss.y, priceAtCursor, priceMax, fraction);

  ctx.restore();
}

function drawCrosshairTimeLabel(
  ctx: CanvasRenderingContext2D,
  plotRect: IAxisRect,
  cursorX: number,
  label: string
): void {
  const metrics = ctx.measureText(label);
  const boxWidth = metrics.width + 2 * LABEL_PADDING_X;
  const boxHeight = AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;
  // Pin the box to the X axis baseline, centred on the cursor. Clamp
  // horizontally so the label stays fully visible when the cursor is
  // close to either edge of the plot area.
  const idealX = cursorX - boxWidth / 2;
  const clampedX = Math.max(plotRect.left, Math.min(plotRect.right - boxWidth, idealX));
  const boxY = plotRect.bottom - boxHeight;

  ctx.fillStyle = CROSSHAIR_LABEL_BG_COLOR;
  ctx.fillRect(clampedX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = CROSSHAIR_LABEL_FG_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, clampedX + boxWidth / 2, boxY + boxHeight / 2);
}

function drawCrosshairPriceLabel(
  ctx: CanvasRenderingContext2D,
  yAxisRect: IAxisRect,
  cursorY: number,
  price: number,
  priceMax: number,
  fraction: number
): void {
  const label = price.toFixed(fraction);
  const panelWidth = yAxisRect.right - yAxisRect.left;
  const boxHeight = AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;
  // Clamp vertically so the label stays inside the Y-axis panel even
  // when the cursor hugs the top or bottom edge.
  const idealY = cursorY - boxHeight / 2;
  const clampedY = Math.max(yAxisRect.top, Math.min(yAxisRect.bottom - boxHeight, idealY));

  ctx.fillStyle = CROSSHAIR_LABEL_BG_COLOR;
  ctx.fillRect(yAxisRect.left, clampedY, panelWidth, boxHeight);

  // Same left-hugging monospace anchor as `drawYAxisPanel` so
  // the highlighted cursor label lines up vertically with the regular
  // price column — digits stay in the same columns as the cursor
  // slides up and down.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const widestLabel = priceMax.toFixed(fraction);
  const labelBoxWidthPx = ctx.measureText(widestLabel).width;
  const labelX = yAxisRect.left + LABEL_PADDING_X + labelBoxWidthPx;

  ctx.fillStyle = CROSSHAIR_LABEL_FG_COLOR;
  ctx.fillText(label, labelX, clampedY + boxHeight / 2);
}
