import type { ILoadingRegion } from '../../domain/types';

const LOADING_BAR_HEIGHT_PX = 5;
const SHIMMER_COLOR_LIGHT = 'rgba(100, 160, 255, 0.6)';
const SHIMMER_COLOR_DARK = 'rgba(30, 80, 180, 0.8)';
const SHIMMER_CYCLE_MS = 1200;
const SHIMMER_GRADIENT_HEIGHT_RATIO = 2;
const SHIMMER_GRADIENT_MIDPOINT = 0.5;

/** A shimmering bar along the bottom edge under every time range still being loaded. */
export function drawLoadingBars(params: {
  readonly ctx: CanvasRenderingContext2D;
  readonly regions: readonly ILoadingRegion[];
  readonly timeStart: number;
  readonly timeEnd: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly devicePixelRatio: number;
  readonly nowMs: number;
}): void {
  const { ctx, regions, timeStart, timeEnd, canvasWidth, canvasHeight, devicePixelRatio, nowMs } =
    params;
  const timeRange = timeEnd - timeStart;
  if (regions.length === 0 || timeRange <= 0) {
    return;
  }

  const barHeight = LOADING_BAR_HEIGHT_PX * Math.max(1, devicePixelRatio);
  const barY = canvasHeight - barHeight;
  const phase = (nowMs % SHIMMER_CYCLE_MS) / SHIMMER_CYCLE_MS;
  const gradientHeight = barHeight * SHIMMER_GRADIENT_HEIGHT_RATIO;
  const shimmerY = barY - gradientHeight + phase * gradientHeight;

  for (const region of regions) {
    const pixelStart = Math.max(
      0,
      Math.floor(((region.timeStart - timeStart) / timeRange) * canvasWidth)
    );
    const pixelEnd = Math.min(
      canvasWidth,
      Math.ceil(((region.timeEnd - timeStart) / timeRange) * canvasWidth)
    );
    if (pixelEnd <= pixelStart) {
      continue;
    }

    const gradient = ctx.createLinearGradient(0, shimmerY, 0, shimmerY + gradientHeight);
    gradient.addColorStop(0, SHIMMER_COLOR_LIGHT);
    gradient.addColorStop(SHIMMER_GRADIENT_MIDPOINT, SHIMMER_COLOR_DARK);
    gradient.addColorStop(1, SHIMMER_COLOR_LIGHT);

    ctx.save();
    ctx.beginPath();
    ctx.rect(pixelStart, barY, pixelEnd - pixelStart, barHeight);
    ctx.clip();
    ctx.fillStyle = gradient;
    ctx.fillRect(pixelStart, shimmerY, pixelEnd - pixelStart, gradientHeight);
    ctx.restore();
  }
}
