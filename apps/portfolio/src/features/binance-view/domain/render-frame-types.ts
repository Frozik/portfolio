import type { IOrderbookSnapshot, UnixTimeMs } from './types';

/**
 * Per-frame input the renderer pulls from the chart state: the resolved
 * viewport, magnitude bounds, cursor and hover state — everything the
 * layers need, read once per frame so they never query controllers.
 */
export interface IRenderFrameInput {
  readonly viewTimeStartMs: UnixTimeMs;
  readonly viewTimeEndMs: UnixTimeMs;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly magnitudeMin: number;
  readonly magnitudeMax: number;
  readonly priceStep: number;
  readonly timeStepMs: number;
  /** Cursor position in CSS pixels relative to canvas, or `undefined` when outside. */
  readonly cursorCss: { readonly x: number; readonly y: number } | undefined;
  /**
   * Latest snapshot at the right edge of the viewport, painted as per-level
   * volume bars in the Y-axis panel. `undefined` until the first driver tick.
   */
  readonly lastSnapshot: IOrderbookSnapshot | undefined;
  /** Trade bucket under the cursor, driving the hover scale animation. */
  readonly hoveredBucketKey: UnixTimeMs | undefined;
}
