import type { BlockSpatialIndex } from '../../domain/block-store/block-spatial-index';
import type { IHeatmapBlockIndexItem } from '../../domain/block-store/create-heatmap-block-index';
import type { IMidPriceBlockIndexItem } from '../../domain/block-store/create-mid-price-block-index';
import type { IRenderFrameInput } from '../../domain/render-frame-types';
import type { ITradeBlockIndexItem } from '../../domain/trades-types';
import type { IHeatmapViewport } from '../../domain/types';

/**
 * Narrow read-only view of the chart state surface that layer renderers
 * consume. Defining it here (instead of importing the concrete
 * `BinanceChartState`) keeps layer-renderer.ts free of inbound
 * dependencies on `application/chart-state.ts`, which itself imports
 * `BinanceChartRenderer` and would otherwise create a 4-file import
 * cycle (chart-state → binance-chart-renderer → heatmap-layer-renderer
 * → layer-renderer → chart-state).
 *
 * Trades-specific fields will be added structurally as later steps wire
 * up the trades layer.
 */
export interface ILayerChartStateView {
  readonly registry: BlockSpatialIndex<IHeatmapBlockIndexItem>;
  readonly midPriceIndex: BlockSpatialIndex<IMidPriceBlockIndexItem>;
  readonly tradesIndex: BlockSpatialIndex<ITradeBlockIndexItem>;
  /** Live viewport — layers read it during `computeFrameState` only. */
  readonly viewport: IHeatmapViewport;
}

/**
 * Structural shape of the trades stream store — referenced by
 * {@link ILayerFrameContext.tradesStore} so layer renderers can read
 * trades-specific reactive state without importing the concrete
 * `TradesStreamStore`. Structural typing is load-bearing here:
 * `TradesStreamStore` already depends on `BinanceChartState` →
 * `BinanceChartRenderer` → this module, so a nominal import would close
 * a cycle inside the application layer.
 */
export interface ITradesLayerStoreShape {
  readonly hoveredBucketKey: number | undefined;
}

/**
 * Per-frame context passed to every {@link ILayerRenderer}. Owned by
 * {@link BinanceChartRenderer} (the orchestrator); each layer reads
 * exactly the fields it needs in `computeFrameState` and never mutates
 * them.
 *
 * `tradesStore` is optional because only the trades layer needs it; the
 * heatmap and mid-price layers ignore it. Keeping it on the shared
 * context avoids per-layer-typed inputs and `unknown`-erasure in the
 * orchestrator.
 */
export interface ILayerFrameContext {
  readonly chartState: ILayerChartStateView;
  readonly viewport: IHeatmapViewport;
  /**
   * Snapshot of viewport-derived state for this frame (resolved
   * `viewTimeStartMs`, magnitude bounds, `priceStep`, cursor position,
   * etc.). Built once per frame by the orchestrator and shared across
   * every layer so layers don't re-query the controller.
   */
  readonly frameInput: IRenderFrameInput;
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  readonly devicePixelRatio: number;
  /** `performance.now()` snapshot taken once at frame start. */
  readonly nowMs: number;
  readonly tradesStore?: ITradesLayerStoreShape | undefined;
}

/**
 * Contract every layer renderer (`HeatmapLayerRenderer`,
 * `MidPriceLayerRenderer`, `TradesLayerRenderer`) implements. The
 * orchestrator drives all three lifecycle methods in sequence, once per
 * frame, in layer-array order.
 *
 * Strict separation:
 *   1. `computeFrameState` — only place reactive observables are read.
 *   2. `writeGpuResources` — only place GPU buffers / textures are
 *      written. Receives the encoder + queue from the orchestrator.
 *   3. `recordDrawCalls` — only place draw calls are issued. No state
 *      mutations and no observable reads here.
 *
 * Splitting these phases lets the orchestrator batch all layers into a
 * single render pass and keeps MobX reads predictable (one observation
 * graph snapshot per frame, not per layer×phase).
 */
export interface ILayerRenderer {
  /** Compute per-frame state from `ctx`. May read MobX observables. */
  computeFrameState(ctx: ILayerFrameContext): void;

  /**
   * Upload uniforms / descriptors / textures that the layer's
   * {@link recordDrawCalls} will consume in this frame. The orchestrator
   * supplies the active command encoder and queue; layers must not
   * keep references to either past the call.
   */
  writeGpuResources(encoder: GPUCommandEncoder, queue: GPUQueue): void;

  /**
   * Append the layer's draw calls to the active render pass. Pure: no
   * observable reads, no state mutations.
   */
  recordDrawCalls(pass: GPURenderPassEncoder): void;

  /** Tear down GPU resources owned by this layer. */
  dispose(): void;
}
