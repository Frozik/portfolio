import type { IAxisDrawInput, IAxisRect } from './shared';
import { priceToY } from './shared';

export const PRICE_DEFAULT_FRACTION_DIGITS = 2;

const MAX_FRACTION_DIGITS = 8;

export function fractionDigitsFor(step: number): number {
  if (step >= 1) {
    return 0;
  }
  return Math.min(MAX_FRACTION_DIGITS, Math.ceil(-Math.log10(step)));
}

/**
 * Horizontal dividers aligned to every aggregation bin boundary.
 * Matches the heatmap cell grid (one row per `priceStep` USD), and
 * gives the right-hand panel rectangles a visual top/bottom edge on
 * the plot side so the viewer reads a continuous row.
 */
export function drawPriceGrid(
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
