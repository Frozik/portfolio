import { SCENE_BACKGROUND_HEX } from '@frozik/utils/webgpu/backgroundColor';

import { GRID_LINE_COLOR } from '../constants';
import type { IChartFrameLayout } from '../frame-layout';

import { timeToPixelX, valueToPixelY } from './shared';

const GRID_LINE_WIDTH_RATIO = 0.5;
const GRID_DASH_LENGTH = 10;

/**
 * Paint the chart background and the dashed grid lines under the GPU pass.
 * Every visible tick contributes one line to a single stroked path.
 */
export function drawChartGrid(ctx: CanvasRenderingContext2D, layout: IChartFrameLayout): void {
  const { dpr, plotLeft, plotTop, plotRight, plotBottom, xTicks, yTicks } = layout;

  ctx.fillStyle = SCENE_BACKGROUND_HEX;
  ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = dpr * GRID_LINE_WIDTH_RATIO;
  ctx.setLineDash([GRID_DASH_LENGTH * dpr, GRID_DASH_LENGTH * dpr]);
  ctx.beginPath();

  for (const tick of xTicks) {
    const pixelX = timeToPixelX(layout, tick.position);

    if (pixelX < plotLeft || pixelX > plotRight) {
      continue;
    }

    ctx.moveTo(pixelX, plotTop);
    ctx.lineTo(pixelX, plotBottom);
  }

  for (const tick of yTicks) {
    const pixelY = valueToPixelY(layout, tick.position);

    if (pixelY < plotTop || pixelY > plotBottom) {
      continue;
    }

    ctx.moveTo(plotLeft, pixelY);
    ctx.lineTo(plotRight, pixelY);
  }

  ctx.stroke();
  ctx.setLineDash([]);
}
