import {
  AXIS_FONT_SIZE,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  Y_AXIS_PANEL_BG_COLOR,
  Y_AXIS_ROW_DIVIDER_COLOR,
  Y_AXIS_VOLUME_ASK_COLOR,
  Y_AXIS_VOLUME_BAR_INSET_PX,
  Y_AXIS_VOLUME_BID_COLOR,
  Y_AXIS_VOLUME_MIN_BAR_WIDTH_PX,
} from '../constants';

import { fractionDigitsFor, PRICE_DEFAULT_FRACTION_DIGITS } from './price-axis';
import type { IAxisDrawInput, IAxisRect } from './shared';
import { LABEL_PADDING_X, LABEL_PADDING_Y, priceToY } from './shared';

const VOLUME_BAR_LABEL_COLOR = '#ffffff';
const VOLUME_LABEL_RIGHT_PADDING_PX = 3;

const THOUSAND = 1e3;
const MILLION = 1e6;
const VOLUME_K_FRACTION_DIGITS = 3;
const VOLUME_M_FRACTION_DIGITS = 3;
const VOLUME_DEFAULT_FRACTION_DIGITS = 2;

const MIN_BAR_HEIGHT_PX = 2;
const ROW_HEIGHT_BAR_GAP_THRESHOLD_PX = 3;
const ROW_HEIGHT_BAR_GAP_PX = 1;

/**
 * Format a numeric volume into a compact K/M string that fits inside a
 * narrow bar. Matches the mockup's `458.886K` / `2.696M` style so the
 * decimal places stay consistent regardless of magnitude.
 */
function formatVolumeLabel(volume: number): string {
  if (volume >= MILLION) {
    return `${(volume / MILLION).toFixed(VOLUME_M_FRACTION_DIGITS)}M`;
  }
  if (volume >= THOUSAND) {
    return `${(volume / THOUSAND).toFixed(VOLUME_K_FRACTION_DIGITS)}K`;
  }
  return volume.toFixed(VOLUME_DEFAULT_FRACTION_DIGITS);
}

interface IVisibleLevel {
  readonly price: number;
  readonly volume: number;
  readonly side: 'bid' | 'ask';
}

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
  const barHeightPx = Math.max(
    MIN_BAR_HEIGHT_PX,
    rowHeightPx > ROW_HEIGHT_BAR_GAP_THRESHOLD_PX
      ? rowHeightPx - ROW_HEIGHT_BAR_GAP_PX
      : rowHeightPx
  );
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
 * Right-hand Y-axis panel. For every aggregation bin visible in the
 * viewport, paint a rectangle whose height exactly matches the
 * corresponding heatmap cell row, with the bin's central price
 * printed inside. When the viewport is zoomed out enough that
 * individual rows are shorter than a text line, labels are dropped
 * on a `labelStride` so they don't overlap — rows themselves still
 * render as continuous dividers.
 */
export function drawYAxisPanel(
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
