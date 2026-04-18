import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  CROSSHAIR_LABEL_BG_COLOR,
  CROSSHAIR_LABEL_FG_COLOR,
  CROSSHAIR_LINE_COLOR,
  CROSSHAIR_LINE_DASH,
  GRID_LINE_COLOR,
  Y_AXIS_PANEL_BG_COLOR,
  Y_AXIS_ROW_DIVIDER_COLOR,
  Y_AXIS_VOLUME_ASK_COLOR,
  Y_AXIS_VOLUME_BAR_INSET_PX,
  Y_AXIS_VOLUME_BID_COLOR,
  Y_AXIS_VOLUME_MIN_BAR_WIDTH_PX,
} from './constants';
import { plotWidthCssPx } from './math';
import type { IOrderbookSnapshot, UnixTimeMs } from './types';

const MINUTE_MS = 60 * 1000;
const MINUTE_GRID_LINE_WIDTH_PX = 3;
const DEFAULT_GRID_LINE_WIDTH_PX = 1;
const TICK_LENGTH_PX = 4;
const MIN_X_TICK_SPACING_PX = 80;
const MIN_TARGET_TICKS = 2;
const PRICE_DEFAULT_FRACTION_DIGITS = 2;
const TIME_PAD = 2;
const LABEL_BACKGROUND = 'rgba(26, 26, 26, 0.85)';
const LABEL_PADDING_X = 3;
const LABEL_PADDING_Y = 2;

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

function formatTimeLabel(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = date.getUTCHours().toString().padStart(TIME_PAD, '0');
  const minutes = date.getUTCMinutes().toString().padStart(TIME_PAD, '0');
  const seconds = date.getUTCSeconds().toString().padStart(TIME_PAD, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function fractionDigitsFor(step: number): number {
  if (step >= 1) {
    return 0;
  }
  return Math.min(8, Math.ceil(-Math.log10(step)));
}

export interface IAxisDrawInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  readonly devicePixelRatio: number;
  readonly viewTimeStartMs: UnixTimeMs;
  readonly viewTimeEndMs: UnixTimeMs;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly priceStep: number;
  /** Cursor position (CSS px, canvas-relative) for the crosshair overlay. */
  readonly cursorCss?: { readonly x: number; readonly y: number } | undefined;
  /**
   * Latest snapshot at the right edge of the viewport. When present,
   * the Y-axis panel paints a bid/ask volume bar for every level that
   * falls inside the visible price range, normalised to the heaviest
   * level on screen. `undefined` while the 2 Hz snapshot driver
   * hasn't produced a first result yet.
   */
  readonly lastSnapshot?: IOrderbookSnapshot | undefined;
}

interface IAxisRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * The plot rect is the heatmap area in CSS pixels — full canvas
 * minus the right-hand Y-axis panel. The GPU heatmap shader maps
 * time across the same rect (via the `plotWidthPx` uniform), so
 * grid lines / tick labels stay aligned with cells pixel-for-pixel.
 */
function buildPlotRect(input: IAxisDrawInput): IAxisRect {
  const canvasWidthCss = input.canvasWidthPx / input.devicePixelRatio;
  const canvasHeightCss = input.canvasHeightPx / input.devicePixelRatio;
  return {
    left: 0,
    right: plotWidthCssPx(canvasWidthCss),
    top: 0,
    bottom: canvasHeightCss,
  };
}

/** Right-hand strip that hosts per-level price rectangles. */
function buildYAxisRect(input: IAxisDrawInput): IAxisRect {
  const canvasWidthCss = input.canvasWidthPx / input.devicePixelRatio;
  const canvasHeightCss = input.canvasHeightPx / input.devicePixelRatio;
  return {
    left: plotWidthCssPx(canvasWidthCss),
    right: canvasWidthCss,
    top: 0,
    bottom: canvasHeightCss,
  };
}

function priceToY(price: number, rect: IAxisRect, priceMin: number, priceMax: number): number {
  const range = priceMax - priceMin;
  if (range <= 0) {
    return rect.bottom;
  }
  const heightPx = rect.bottom - rect.top;
  const normalized = (price - priceMin) / range;
  return rect.bottom - normalized * heightPx;
}

/**
 * Paint only the background grid (no labels, no axis lines). Runs
 * before the heatmap blit so data quads overlay the grid.
 */
export function drawGrid(input: IAxisDrawInput): void {
  const { ctx, devicePixelRatio } = input;
  ctx.save();
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const plotRect = buildPlotRect(input);
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;

  drawTimeGrid(ctx, plotRect, input);
  drawPriceGrid(ctx, plotRect, input);

  ctx.restore();
}

/**
 * Paint axis lines, ticks, time labels and the right-hand Y-axis
 * panel on top of the heatmap blit so they stay readable regardless
 * of cell colours.
 */
export function drawAxisLabels(input: IAxisDrawInput): void {
  const { ctx, devicePixelRatio } = input;
  ctx.save();
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const plotRect = buildPlotRect(input);
  const yAxisRect = buildYAxisRect(input);
  ctx.font = `${AXIS_FONT_SIZE}px ${AXIS_FONT_FAMILY}`;
  ctx.strokeStyle = AXIS_LINE_COLOR;
  ctx.lineWidth = 1;

  drawTimeAxisLabels(ctx, plotRect, input);
  drawYAxisPanel(ctx, yAxisRect, input);
  // Crosshair sits on top of every other layer so its time / price
  // labels cover the regular axis ticks underneath the cursor.
  drawCrosshair(ctx, plotRect, yAxisRect, input);

  ctx.restore();
}

function drawTimeGrid(ctx: CanvasRenderingContext2D, rect: IAxisRect, input: IAxisDrawInput): void {
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

/**
 * Horizontal dividers aligned to every aggregation bin boundary.
 * Matches the heatmap cell grid (one row per `priceStep` USD), and
 * gives the right-hand panel rectangles a visual top/bottom edge on
 * the plot side so the viewer reads a continuous row.
 */
function drawPriceGrid(
  ctx: CanvasRenderingContext2D,
  rect: IAxisRect,
  input: IAxisDrawInput
): void {
  const { priceMin, priceMax, priceStep } = input;
  const range = priceMax - priceMin;
  if (range <= 0 || priceStep <= 0) {
    return;
  }

  // First bin boundary at or above `priceMin + priceStep/2` — i.e. the
  // top edge of the bin whose centre sits immediately above priceMin.
  const firstBoundary = Math.ceil((priceMin + priceStep / 2) / priceStep) * priceStep;
  for (let boundary = firstBoundary; boundary <= priceMax + priceStep / 2; boundary += priceStep) {
    const y = priceToY(boundary - priceStep / 2, rect, priceMin, priceMax);
    ctx.beginPath();
    ctx.moveTo(rect.left, y);
    ctx.lineTo(rect.right, y);
    ctx.stroke();
  }
}

function drawTimeAxisLabels(
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

/**
 * Right-hand Y-axis panel. For every aggregation bin visible in the
 * viewport, paint a rectangle whose height exactly matches the
 * corresponding heatmap cell row, with the bin's central price
 * printed inside. When the viewport is zoomed out enough that
 * individual rows are shorter than a text line, labels are dropped
 * on a `labelStride` so they don't overlap — rows themselves still
 * render as continuous dividers.
 */
function drawYAxisPanel(
  ctx: CanvasRenderingContext2D,
  rect: IAxisRect,
  input: IAxisDrawInput
): void {
  const { priceMin, priceMax, priceStep } = input;
  const heightPx = rect.bottom - rect.top;
  const widthPx = rect.right - rect.left;
  const range = priceMax - priceMin;
  if (heightPx <= 0 || widthPx <= 0 || range <= 0 || priceStep <= 0) {
    return;
  }

  ctx.fillStyle = Y_AXIS_PANEL_BG_COLOR;
  ctx.fillRect(rect.left, rect.top, widthPx, heightPx);

  ctx.strokeStyle = AXIS_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rect.left + 0.5, rect.top);
  ctx.lineTo(rect.left + 0.5, rect.bottom);
  ctx.stroke();

  const rowHeightPx = (priceStep / range) * heightPx;
  const minLabelRowPx = AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;
  const labelStride =
    rowHeightPx >= minLabelRowPx ? 1 : Math.max(1, Math.ceil(minLabelRowPx / rowHeightPx));

  const firstLevel = Math.ceil(priceMin / priceStep) * priceStep;
  const fraction = Math.max(PRICE_DEFAULT_FRACTION_DIGITS, fractionDigitsFor(priceStep));

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Left-hugging labels with right-aligned anchor: we measure the
  // widest possible label (priceMax at the configured fraction — a
  // monospace font makes any number with ≤ this many digits fit in
  // the same visual box) and right-align every label to a shared
  // anchor just past the panel's left border. Decimal points — and
  // every digit column — line up vertically across rows even though
  // the text sits on the *left* side of the panel.
  const widestLabel = priceMax.toFixed(fraction);
  const labelBoxWidthPx = ctx.measureText(widestLabel).width;
  const labelX = rect.left + LABEL_PADDING_X + labelBoxWidthPx;
  const textRowHeightPx = AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;

  // Volume bars sit in the leftover strip on the right of the labels.
  // Render them BEFORE the row dividers / price labels so the dark
  // dividers and light labels draw on top and stay readable.
  drawVolumeBars(ctx, rect, input, labelX + LABEL_PADDING_X);

  let rowIndex = 0;
  for (let level = firstLevel; level <= priceMax; level += priceStep, rowIndex++) {
    const topY = priceToY(level + priceStep / 2, rect, priceMin, priceMax);
    const bottomY = priceToY(level - priceStep / 2, rect, priceMin, priceMax);

    ctx.strokeStyle = Y_AXIS_ROW_DIVIDER_COLOR;
    ctx.beginPath();
    ctx.moveTo(rect.left, Math.round(topY) + 0.5);
    ctx.lineTo(rect.right, Math.round(topY) + 0.5);
    ctx.stroke();

    if (rowIndex % labelStride !== 0) {
      continue;
    }

    const centerY = (topY + bottomY) / 2;
    // Skip labels that would clip outside the panel vertically.
    if (centerY < rect.top + textRowHeightPx / 2 || centerY > rect.bottom - textRowHeightPx / 2) {
      continue;
    }

    ctx.fillStyle = AXIS_LABEL_COLOR;
    ctx.fillText(level.toFixed(fraction), labelX, centerY);
  }
}

/**
 * Format a numeric volume into a compact K/M string that fits inside a
 * narrow bar. Matches the mockup's `458.886K` / `2.696M` style so the
 * decimal places stay consistent regardless of magnitude.
 */
function formatVolumeLabel(volume: number): string {
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(3)}M`;
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(3)}K`;
  }
  return volume.toFixed(2);
}

const VOLUME_BAR_LABEL_COLOR = '#ffffff';
const VOLUME_LABEL_RIGHT_PADDING_PX = 3;

/**
 * Paint one horizontal bar per orderbook level visible on screen,
 * normalised to the heaviest level currently on screen (so the max
 * bar always reaches the right edge and every other bar reads as a
 * percentage of it). Bids use the green fill, asks the red one.
 *
 * Bars are right-anchored to the panel's right edge and grow
 * leftwards, which is the convention every trading-desk orderbook
 * ladder uses — the decoration reads immediately as "volume at
 * price" without needing a legend.
 */
function drawVolumeBars(
  ctx: CanvasRenderingContext2D,
  rect: IAxisRect,
  input: IAxisDrawInput,
  barAreaLeft: number
): void {
  const { lastSnapshot, priceMin, priceMax, priceStep } = input;
  if (lastSnapshot === undefined) {
    return;
  }
  const heightPx = rect.bottom - rect.top;
  const range = priceMax - priceMin;
  if (heightPx <= 0 || range <= 0 || priceStep <= 0) {
    return;
  }

  interface IVisibleLevel {
    readonly price: number;
    readonly volume: number;
    readonly side: 'bid' | 'ask';
  }

  const visibleLevels: IVisibleLevel[] = [];
  let maxVolume = 0;
  for (const [price, volume] of lastSnapshot.bids) {
    if (volume > 0 && price >= priceMin && price <= priceMax) {
      visibleLevels.push({ price, volume, side: 'bid' });
      if (volume > maxVolume) {
        maxVolume = volume;
      }
    }
  }
  for (const [price, volume] of lastSnapshot.asks) {
    if (volume > 0 && price >= priceMin && price <= priceMax) {
      visibleLevels.push({ price, volume, side: 'ask' });
      if (volume > maxVolume) {
        maxVolume = volume;
      }
    }
  }
  if (visibleLevels.length === 0 || maxVolume <= 0) {
    return;
  }

  const barAreaRight = rect.right - Y_AXIS_VOLUME_BAR_INSET_PX;
  const barAreaWidth = Math.max(0, barAreaRight - barAreaLeft);
  if (barAreaWidth <= 0) {
    return;
  }

  const rowHeightPx = (priceStep / range) * heightPx;
  // Leave a 1 px sliver between adjacent rows so bars read as distinct
  // bricks at tight zooms; full row height when the row is tiny.
  const barHeightPx = Math.max(2, rowHeightPx > 3 ? rowHeightPx - 1 : rowHeightPx);
  const showLabels = rowHeightPx >= AXIS_FONT_SIZE + 2;

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (const level of visibleLevels) {
    const ratio = level.volume / maxVolume;
    const barWidth = Math.max(Y_AXIS_VOLUME_MIN_BAR_WIDTH_PX, ratio * barAreaWidth);
    const centerY = priceToY(level.price, rect, priceMin, priceMax);
    const yTop = centerY - barHeightPx / 2;
    ctx.fillStyle = level.side === 'bid' ? Y_AXIS_VOLUME_BID_COLOR : Y_AXIS_VOLUME_ASK_COLOR;
    ctx.fillRect(barAreaRight - barWidth, yTop, barWidth, barHeightPx);

    if (showLabels) {
      ctx.fillStyle = VOLUME_BAR_LABEL_COLOR;
      ctx.fillText(
        formatVolumeLabel(level.volume),
        barAreaRight - VOLUME_LABEL_RIGHT_PADDING_PX,
        centerY
      );
    }
  }

  ctx.restore();
}

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
function drawCrosshair(
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
    const snappedSec = Math.floor(timeAtCursor / 1000) * 1000;
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

  // Same left-hugging monospace anchor as {@link drawYAxisPanel} so
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
