import type { IAxisRect } from '../../../domain/axis-scale';
import { floorToSecond, formatTimeLabel, priceFractionDigits } from '../../../domain/axis-scale';
import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  CROSSHAIR_LABEL_BG_COLOR,
  CROSSHAIR_LABEL_FG_COLOR,
  CROSSHAIR_LINE_COLOR,
  CROSSHAIR_LINE_DASH,
} from '../../../domain/constants';

import type { IAxisDrawInput } from './shared';
import { LABEL_PADDING_X, LABEL_PADDING_Y } from './shared';

/**
 * Dashed crosshair anchored to the cursor with a time label on the X axis
 * and a price label inside the Y-axis panel. The time snaps to whole
 * seconds because the data is quantised at 1 Hz. The vertical line runs
 * through the volume bars too; over them only that line and the time label
 * render, and over the Y-axis panel only the horizontal line and price label.
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  rects: {
    readonly plotRect: IAxisRect;
    readonly yAxisRect: IAxisRect;
    readonly volumeBarsRect: IAxisRect;
  },
  input: IAxisDrawInput
): void {
  const { plotRect, yAxisRect, volumeBarsRect } = rects;
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
  const isCursorInPlotY = cursorCss.y >= plotRect.top && cursorCss.y <= plotRect.bottom;
  const isCursorInBarsY = cursorCss.y > plotRect.top && cursorCss.y <= volumeBarsRect.bottom;
  if (!isCursorInBarsY) {
    return;
  }
  const isCursorInPlotX = cursorCss.x >= plotRect.left && cursorCss.x <= plotRect.right;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CROSSHAIR_LINE_COLOR;
  ctx.setLineDash([...CROSSHAIR_LINE_DASH]);

  if (isCursorInPlotY) {
    ctx.beginPath();
    ctx.moveTo(plotRect.left, cursorCss.y);
    ctx.lineTo(yAxisRect.left, cursorCss.y);
    ctx.stroke();
  }

  if (isCursorInPlotX) {
    ctx.beginPath();
    ctx.moveTo(cursorCss.x, plotRect.top);
    ctx.lineTo(cursorCss.x, volumeBarsRect.bottom);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.font = `${AXIS_FONT_SIZE}px ${AXIS_FONT_FAMILY}`;

  if (isCursorInPlotX) {
    const timeAtCursor = viewTimeStartMs + ((cursorCss.x - plotRect.left) / plotWidth) * rangeMs;
    drawTimeLabel(ctx, plotRect, cursorCss.x, formatTimeLabel(floorToSecond(timeAtCursor)));
  }

  if (isCursorInPlotY) {
    const priceAtCursor = priceMax - ((cursorCss.y - plotRect.top) / plotHeight) * priceRange;
    drawPriceLabel(
      ctx,
      yAxisRect,
      cursorCss.y,
      priceAtCursor,
      priceMax,
      priceFractionDigits(priceStep)
    );
  }

  ctx.restore();
}

function drawTimeLabel(
  ctx: CanvasRenderingContext2D,
  plotRect: IAxisRect,
  cursorX: number,
  label: string
): void {
  const boxWidth = ctx.measureText(label).width + 2 * LABEL_PADDING_X;
  const boxHeight = AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;
  const clampedX = Math.max(
    plotRect.left,
    Math.min(plotRect.right - boxWidth, cursorX - boxWidth / 2)
  );
  const boxY = plotRect.bottom - boxHeight;

  ctx.fillStyle = CROSSHAIR_LABEL_BG_COLOR;
  ctx.fillRect(clampedX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = CROSSHAIR_LABEL_FG_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, clampedX + boxWidth / 2, boxY + boxHeight / 2);
}

function drawPriceLabel(
  ctx: CanvasRenderingContext2D,
  yAxisRect: IAxisRect,
  cursorY: number,
  price: number,
  priceMax: number,
  fraction: number
): void {
  const panelWidth = yAxisRect.right - yAxisRect.left;
  const boxHeight = AXIS_FONT_SIZE + 2 * LABEL_PADDING_Y;
  const clampedY = Math.max(
    yAxisRect.top,
    Math.min(yAxisRect.bottom - boxHeight, cursorY - boxHeight / 2)
  );

  ctx.fillStyle = CROSSHAIR_LABEL_BG_COLOR;
  ctx.fillRect(yAxisRect.left, clampedY, panelWidth, boxHeight);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labelBoxWidthPx = ctx.measureText(priceMax.toFixed(fraction)).width;
  const labelX = yAxisRect.left + LABEL_PADDING_X + labelBoxWidthPx;

  ctx.fillStyle = CROSSHAIR_LABEL_FG_COLOR;
  ctx.fillText(price.toFixed(fraction), labelX, clampedY + boxHeight / 2);
}
