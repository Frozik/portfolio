import type { IAxisRect } from '../../../domain/axis-scale';
import { formatVolumeLabel, priceFractionDigits, priceToY } from '../../../domain/axis-scale';
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
} from '../../../domain/constants';

import type { IAxisDrawInput } from './shared';
import { LABEL_PADDING_X, LABEL_PADDING_Y } from './shared';

const VOLUME_BAR_LABEL_COLOR = '#ffffff';
const VOLUME_LABEL_RIGHT_PADDING_PX = 3;
const MIN_BAR_HEIGHT_PX = 2;
const ROW_HEIGHT_BAR_GAP_THRESHOLD_PX = 3;
const ROW_HEIGHT_BAR_GAP_PX = 1;
const HALF_PIXEL = 0.5;

interface IVisibleLevel {
  readonly price: number;
  readonly volume: number;
  readonly side: 'bid' | 'ask';
}

function collectVisibleLevels(input: IAxisDrawInput): readonly IVisibleLevel[] {
  const { lastSnapshot, priceMin, priceMax } = input;
  if (lastSnapshot === undefined) {
    return [];
  }
  const isVisible = ([price, volume]: readonly [number, number]): boolean =>
    volume > 0 && price >= priceMin && price <= priceMax;
  return [
    ...lastSnapshot.bids.filter(isVisible).map(([price, volume]) => ({
      price,
      volume,
      side: 'bid' as const,
    })),
    ...lastSnapshot.asks.filter(isVisible).map(([price, volume]) => ({
      price,
      volume,
      side: 'ask' as const,
    })),
  ];
}

/**
 * One right-anchored bar per visible orderbook level, normalised to the
 * heaviest level on screen — the convention every trading-desk ladder uses.
 */
function drawVolumeBars(
  ctx: CanvasRenderingContext2D,
  rect: IAxisRect,
  input: IAxisDrawInput,
  barAreaLeft: number
): void {
  const { priceMin, priceMax, priceStep } = input;
  const heightPx = rect.bottom - rect.top;
  const range = priceMax - priceMin;
  if (heightPx <= 0 || range <= 0 || priceStep <= 0) {
    return;
  }

  const visibleLevels = collectVisibleLevels(input);
  const maxVolume = Math.max(0, ...visibleLevels.map(level => level.volume));
  if (visibleLevels.length === 0 || maxVolume <= 0) {
    return;
  }

  const barAreaRight = rect.right - Y_AXIS_VOLUME_BAR_INSET_PX;
  const barAreaWidth = barAreaRight - barAreaLeft;
  if (barAreaWidth <= 0) {
    return;
  }

  const rowHeightPx = (priceStep / range) * heightPx;
  const barHeightPx = Math.max(
    MIN_BAR_HEIGHT_PX,
    rowHeightPx > ROW_HEIGHT_BAR_GAP_THRESHOLD_PX
      ? rowHeightPx - ROW_HEIGHT_BAR_GAP_PX
      : rowHeightPx
  );
  const showLabels = rowHeightPx >= AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (const level of visibleLevels) {
    const barWidth = Math.max(
      Y_AXIS_VOLUME_MIN_BAR_WIDTH_PX,
      (level.volume / maxVolume) * barAreaWidth
    );
    const centerY = priceToY(level.price, rect, priceMin, priceMax);
    ctx.fillStyle = level.side === 'bid' ? Y_AXIS_VOLUME_BID_COLOR : Y_AXIS_VOLUME_ASK_COLOR;
    ctx.fillRect(barAreaRight - barWidth, centerY - barHeightPx / 2, barWidth, barHeightPx);

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
 * Right-hand price panel: one row per visible aggregation bin, its height
 * matching the heatmap cell row, labelled on a stride when rows are shorter
 * than a text line. Labels are right-aligned to a shared anchor so digit
 * columns line up across rows.
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
  ctx.moveTo(rect.left + HALF_PIXEL, rect.top);
  ctx.lineTo(rect.left + HALF_PIXEL, rect.bottom);
  ctx.stroke();

  const rowHeightPx = (priceStep / range) * heightPx;
  const textRowHeightPx = AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;
  const labelStride =
    rowHeightPx >= textRowHeightPx ? 1 : Math.max(1, Math.ceil(textRowHeightPx / rowHeightPx));

  const firstLevel = Math.ceil(priceMin / priceStep) * priceStep;
  const fraction = priceFractionDigits(priceStep);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labelBoxWidthPx = ctx.measureText(priceMax.toFixed(fraction)).width;
  const labelX = rect.left + LABEL_PADDING_X + labelBoxWidthPx;

  drawVolumeBars(ctx, rect, input, labelX + LABEL_PADDING_X);

  let rowIndex = 0;
  for (let level = firstLevel; level <= priceMax; level += priceStep, rowIndex++) {
    const topY = priceToY(level + priceStep / 2, rect, priceMin, priceMax);
    const bottomY = priceToY(level - priceStep / 2, rect, priceMin, priceMax);

    ctx.strokeStyle = Y_AXIS_ROW_DIVIDER_COLOR;
    ctx.beginPath();
    ctx.moveTo(rect.left, Math.round(topY) + HALF_PIXEL);
    ctx.lineTo(rect.right, Math.round(topY) + HALF_PIXEL);
    ctx.stroke();

    if (rowIndex % labelStride !== 0) {
      continue;
    }

    const centerY = (topY + bottomY) / 2;
    if (centerY < rect.top + textRowHeightPx / 2 || centerY > rect.bottom - textRowHeightPx / 2) {
      continue;
    }

    ctx.fillStyle = AXIS_LABEL_COLOR;
    ctx.fillText(level.toFixed(fraction), labelX, centerY);
  }
}
