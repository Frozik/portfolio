import { plotWidthCssPx } from '../math';
import type { IOrderbookSnapshot, UnixTimeMs } from '../types';

export const LABEL_PADDING_X = 3;
export const LABEL_PADDING_Y = 2;

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

export interface IAxisRect {
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
export function buildPlotRect(input: IAxisDrawInput): IAxisRect {
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
export function buildYAxisRect(input: IAxisDrawInput): IAxisRect {
  const canvasWidthCss = input.canvasWidthPx / input.devicePixelRatio;
  const canvasHeightCss = input.canvasHeightPx / input.devicePixelRatio;
  return {
    left: plotWidthCssPx(canvasWidthCss),
    right: canvasWidthCss,
    top: 0,
    bottom: canvasHeightCss,
  };
}

export function priceToY(
  price: number,
  rect: IAxisRect,
  priceMin: number,
  priceMax: number
): number {
  const range = priceMax - priceMin;
  if (range <= 0) {
    return rect.bottom;
  }
  const heightPx = rect.bottom - rect.top;
  const normalized = (price - priceMin) / range;
  return rect.bottom - normalized * heightPx;
}
