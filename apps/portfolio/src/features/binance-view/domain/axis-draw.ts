import { drawCrosshair } from './axis-draw/crosshair';
import { drawPriceGrid } from './axis-draw/price-axis';
import type { IAxisDrawInput } from './axis-draw/shared';
import { buildPlotRect, buildYAxisRect } from './axis-draw/shared';
import { drawTimeAxisLabels, drawTimeGrid } from './axis-draw/time-axis';
import { drawYAxisPanel } from './axis-draw/y-axis-panel';
import { AXIS_FONT_FAMILY, AXIS_FONT_SIZE, AXIS_LINE_COLOR, GRID_LINE_COLOR } from './constants';

export type { IAxisDrawInput } from './axis-draw/shared';

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
