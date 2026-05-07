import type { ITrade, ITradeBlockMeta } from './trades-types';
import type { IOrderbookSnapshot, UnixTimeMs } from './types';

/**
 * Per-frame input pulled by the renderer from the viewport / data
 * controller. Built once per frame by `BinanceChartState` and threaded
 * through the layer renderers so each layer can read the snapshot of
 * viewport-derived state without re-querying the controller multiple
 * times.
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
   * Latest snapshot at the right edge of the viewport, used by the
   * Y-axis panel overlay to paint per-level volume bars. `undefined`
   * during warm-up (before the first 2 Hz driver tick) — the overlay
   * simply skips the bars in that case.
   */
  readonly lastSnapshot: IOrderbookSnapshot | undefined;
}

/**
 * Argument shape passed to the 2D-canvas overlay callbacks (grid +
 * axis labels) registered on the renderer. Built per frame inside the
 * renderer just before invoking each callback.
 */
export interface IFrameOverlayInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  readonly devicePixelRatio: number;
  readonly frame: IRenderFrameInput;
}

export type FrameOverlayCallback = (input: IFrameOverlayInput) => void;

/**
 * Shape of a mid-price flush event crossing the domain boundary from
 * the mid-price accumulator (infrastructure) into the renderer. Kept
 * structurally identical to the orderbook flush bridge so the
 * dependency direction stays
 * `presentation → application → domain ← infrastructure`.
 */
export interface IMidPriceFlushEventBridge {
  readonly block: {
    readonly blockId: UnixTimeMs;
    readonly firstTimestampMs: UnixTimeMs;
    readonly basePrice: number;
    lastTimestampMs: UnixTimeMs;
    count: number;
    textureRowIndex: number | undefined;
  };
  readonly data: Float32Array;
  readonly isNewBlock: boolean;
  readonly addedSamples: number;
}

/**
 * Shape of a trade-block flush event crossing the domain boundary from
 * `TradeBucketAccumulator` (infrastructure) into the renderer / chart-
 * state (domain). Mirrors `ITradeBlockFlushEvent` from
 * `infrastructure/trade-bucket-accumulator.ts` so the domain layer
 * doesn't import infrastructure — preserves the
 * `presentation → application → domain ← infrastructure` direction.
 */
export interface ITradeBlockFlushEventBridge {
  readonly block: ITradeBlockMeta;
  readonly data: Float32Array;
  readonly rawTradesByBucket: ReadonlyMap<UnixTimeMs, ITrade[]>;
  readonly isNewBlock: boolean;
}
