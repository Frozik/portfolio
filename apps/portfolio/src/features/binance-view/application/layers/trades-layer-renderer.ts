import { plotWidthDevicePx } from '../../domain/math';
import type { ITradeBlockFlushEventBridge } from '../../domain/render-frame-types';
import {
  DEFAULT_SCALING_MODE,
  FILL_OPACITY_AT_MAX_RADIUS,
  FILL_OPACITY_AT_MIN_RADIUS,
  FLOATS_PER_BUCKET,
  HIT_TOLERANCE_MS,
  MAX_BUCKETS_PER_BLOCK,
  MAX_TRADE_BLOCKS_IN_RAM,
  RADIUS_MAX_PRICE_TICK_MULT,
  RADIUS_MIN_PRICE_TICK_MULT,
} from '../../domain/trades-constants';
import type { ITradesLayerResources, ITradesVisibleBucket } from '../../domain/trades-layer';
import {
  createTradesBindGroup,
  createTradesResources,
  TRADES_VERTEX_COUNT_PER_INSTANCE,
  writeTradesBucketDescriptors,
  writeTradesUniforms,
} from '../../domain/trades-layer';
import type { IViewportStats } from '../../domain/trades-scaling';
import { computeBucketViewportStats, computeRadiusPx } from '../../domain/trades-scaling';
import type { UnixTimeMs } from '../../domain/types';
import type { IHoverAnimState } from './hover-anim-controller';
import {
  INITIAL_HOVER_STATE,
  startEnterTransition,
  startLeaveTransition,
  tickHoverAnim,
} from './hover-anim-controller';
import type { ILayerFrameContext, ILayerRenderer } from './layer-renderer';

export interface ITradesLayerRendererParams {
  readonly device: GPUDevice;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly pipeline: GPURenderPipeline;
}

/**
 * Per-frame state captured during {@link TradesLayerRenderer.computeFrameState}
 * and consumed by {@link TradesLayerRenderer.writeGpuResources}. Stored
 * as a single nullable field so the layer's render-phase invariants
 * stay obvious — either every derived value is set together (visible-
 * buckets branch) or `null` (no buckets visible this frame, draw is
 * skipped).
 */
interface ITradesFrameState {
  readonly visibleBuckets: ReadonlyArray<ITradesVisibleBucket>;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly devicePixelRatio: number;
}

/**
 * Time padding (ms) applied on both sides of the visible window when
 * collecting candidate trade blocks / buckets. Matches the click hit-
 * test tolerance (see `HIT_TOLERANCE_MS`) so a bucket whose centre sits
 * just off-screen but whose hit-zone overlaps the visible plot still
 * renders.
 */
const VIEWPORT_TIME_PADDING_MS = HIT_TOLERANCE_MS;

/**
 * Trades layer renderer — encapsulates the per-bucket descriptor
 * pipeline, GPU resources, hover-animation state machine and per-frame
 * compute / upload / draw lifecycle for the trades visual.
 *
 * The orchestrator ({@link BinanceChartRenderer}) drives this layer via
 * the three-phase {@link ILayerRenderer} contract — observable reads
 * happen only in `computeFrameState` (hover key from the trades store),
 * GPU buffer writes happen only in `writeGpuResources`, and draw calls
 * happen only in `recordDrawCalls`.
 *
 * Block ingestion: `BinanceChartState.ingestTradesFlush` owns the
 * single-writer invariant for `tradesIndex` and forwards the block's
 * `Float32Array` reference to {@link TradesLayerRenderer.ingestFlush}.
 * The layer keeps the reference alive until the orchestrator releases
 * the slot via {@link TradesLayerRenderer.releaseBlockSlot}.
 *
 * Hover animation lives outside MobX (see `hover-anim-controller.ts`):
 * the renderer reads `tradesStore.hoveredBucketKey` once per frame and
 * feeds enter / leave transitions through the pure state machine —
 * scale lerp + delay are sampled in `computeFrameState` so the rest of
 * the GPU pipeline stays free of reactive ceremony.
 */
export class TradesLayerRenderer implements ILayerRenderer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly resources: ITradesLayerResources;
  private readonly bindGroup: GPUBindGroup;

  /**
   * Holds the authoritative `Float32Array` reference for every block
   * that has been flushed into the layer. Owned alongside the
   * `tradesIndex` entry maintained by `BinanceChartState`; cleared by
   * {@link TradesLayerRenderer.releaseBlockSlot} when the rolling
   * window evicts a block.
   */
  private readonly blockDataByBlockId = new Map<UnixTimeMs, Float32Array>();

  private hoverAnimState: IHoverAnimState = INITIAL_HOVER_STATE;
  private lastObservedHoverKey: UnixTimeMs | undefined = undefined;

  private frameState: ITradesFrameState | null = null;
  /**
   * Per-frame `(vMin, vMax)` envelope produced by the renderer's volume
   * stats reduction. Cached on the layer so the synchronous hit-test
   * resolver in `TradesStreamStore.findBucketAt` can read the same
   * envelope the renderer used this frame — keeps the click hit-zone
   * congruent with the rendered radius envelope. `undefined` when no
   * buckets were visible in the most recent `computeFrameState`.
   */
  private lastFrameStats: IViewportStats | undefined = undefined;

  constructor(params: ITradesLayerRendererParams) {
    this.device = params.device;
    this.pipeline = params.pipeline;

    this.resources = createTradesResources(
      params.device,
      MAX_TRADE_BLOCKS_IN_RAM * MAX_BUCKETS_PER_BLOCK
    );
    this.bindGroup = createTradesBindGroup(params.device, params.bindGroupLayout, this.resources);
  }

  /**
   * Store the block's authoritative `Float32Array` reference so
   * {@link TradesLayerRenderer.computeFrameState} can decode visible
   * buckets without dereferencing the active accumulator. The spatial-
   * index upsert happens in `BinanceChartState.ingestTradesFlush`
   * (single-writer for `tradesIndex`).
   */
  ingestFlush(event: ITradeBlockFlushEventBridge): void {
    this.blockDataByBlockId.set(event.block.blockId, event.data);
  }

  /**
   * Drop the block's data reference. The orchestrator (via chart-
   * state) is responsible for removing the matching `tradesIndex`
   * entry — this layer only owns the GPU-bound descriptor cache.
   */
  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.blockDataByBlockId.delete(blockId);
  }

  /**
   * Latest per-frame volume envelope (`vMin / vMax`) used by the layer
   * to map bucket volumes to pixel radii. Exposed so the hit-test
   * resolver in `TradesStreamStore.findBucketAt` can re-derive the same
   * radii without a redundant pass over the visible buckets — keeps the
   * click envelope congruent with the rendered envelope (in `Log` mode
   * the diverging multipliers used to drift on tiny buckets).
   *
   * Returns `undefined` when no buckets were visible in the most recent
   * frame; callers should fall back to an empty stats envelope in that
   * case.
   */
  getLastFrameStats(): IViewportStats | undefined {
    return this.lastFrameStats;
  }

  computeFrameState(ctx: ILayerFrameContext): void {
    const tradesIndex = ctx.chartState.tradesIndex;
    const viewStartMs = ctx.frameInput.viewTimeStartMs;
    const viewEndMs = ctx.frameInput.viewTimeEndMs;
    const priceMin = ctx.frameInput.priceMin;
    const priceMax = ctx.frameInput.priceMax;

    // Wide range — buckets whose hit-zone overlaps the plot but whose
    // centres sit just off-screen still need to be rendered.
    const searchFromMs = (viewStartMs - VIEWPORT_TIME_PADDING_MS) as UnixTimeMs;
    const searchToMs = (viewEndMs + VIEWPORT_TIME_PADDING_MS) as UnixTimeMs;
    const candidateBlocks = tradesIndex.searchRange(searchFromMs, searchToMs);

    // First pass — unpack each visible bucket and collect volumes for
    // the per-frame stats envelope. We can't compute radii yet because
    // the volume stats depend on every bucket in the viewport.
    interface IDecodedBucket {
      readonly bucketStartMs: UnixTimeMs;
      readonly centerTimeDeltaMs: number;
      readonly centerPriceDelta: number;
      readonly volumeTotal: number;
      readonly buyFraction: number;
    }
    const decodedBuckets: IDecodedBucket[] = [];
    const volumes: number[] = [];

    for (const item of candidateBlocks) {
      const data = this.blockDataByBlockId.get(item.blockId);
      if (data === undefined) {
        continue;
      }
      for (let bucketIndex = 0; bucketIndex < item.bucketCount; bucketIndex++) {
        const offset = bucketIndex * FLOATS_PER_BUCKET;
        const timeDeltaMs = data[offset + 0];
        const priceDelta = data[offset + 1];
        const volumeTotal = data[offset + 2];
        const buyFraction = data[offset + 3];

        const bucketStartMs = (item.minX + timeDeltaMs) as UnixTimeMs;
        if (bucketStartMs < searchFromMs || bucketStartMs > searchToMs) {
          continue;
        }
        const vwap = item.basePrice + priceDelta;

        decodedBuckets.push({
          bucketStartMs,
          // Anchored at viewTimeStart so the shader sees a low-magnitude
          // float (uniform `viewTimeStartDeltaMs` is already 0 below).
          centerTimeDeltaMs: bucketStartMs - viewStartMs,
          // Anchored at priceMin for the same reason — the shader's
          // `priceMin` uniform is 0 in this co-ordinate frame.
          centerPriceDelta: vwap - priceMin,
          volumeTotal,
          buyFraction,
        });
        volumes.push(volumeTotal);
      }
    }

    if (decodedBuckets.length === 0) {
      this.frameState = null;
      this.lastFrameStats = undefined;
      return;
    }

    const stats = computeBucketViewportStats(volumes, DEFAULT_SCALING_MODE);
    this.lastFrameStats = stats;

    const priceTickPx = priceTickHeightInDevicePx(ctx);
    const rMinPx = priceTickPx * RADIUS_MIN_PRICE_TICK_MULT;
    const rMaxPx = priceTickPx * RADIUS_MAX_PRICE_TICK_MULT;

    // Hover anim: feed transition edges from the (optional) trades
    // store. Lives outside MobX so per-frame ticks don't pay reactive
    // ceremony — the only observable read is the hover key snapshot.
    const hoveredKey = ctx.tradesStore?.hoveredBucketKey as UnixTimeMs | undefined;
    if (hoveredKey !== this.lastObservedHoverKey) {
      if (hoveredKey !== undefined) {
        this.hoverAnimState = startEnterTransition(this.hoverAnimState, hoveredKey, ctx.nowMs);
      } else {
        this.hoverAnimState = startLeaveTransition(this.hoverAnimState, ctx.nowMs);
      }
      this.lastObservedHoverKey = hoveredKey;
    }
    const { activeBucketKey, scale } = tickHoverAnim(this.hoverAnimState, ctx.nowMs);

    // Z-lift: the hovered bucket is rendered last so it appears on top
    // of every overlapping circle while the cursor is inside it. Keeps
    // the renderer's stacking order in sync with `findBucketsAt`'s
    // most-recent-wins priority — the user always sees the bucket they
    // can interact with.
    const visibleBuckets: ITradesVisibleBucket[] = [];
    let liftedBucket: ITradesVisibleBucket | undefined;
    // Opacity envelope independent of the radius envelope width — guards
    // against div-by-zero when only a single bucket is visible.
    const radiusSpread = rMaxPx - rMinPx;
    for (const bucket of decodedBuckets) {
      const baseRadius = computeRadiusPx(
        bucket.volumeTotal,
        stats,
        rMinPx,
        rMaxPx,
        DEFAULT_SCALING_MODE
      );
      // Fill opacity is a function of the BASE (pre-hover) radius so
      // hovering doesn't change a circle's transparency — it only
      // grows it. Bigger circles are more transparent so the heatmap
      // stays readable underneath.
      const opacityT = radiusSpread > 0 ? (baseRadius - rMinPx) / radiusSpread : 0;
      const fillOpacity =
        FILL_OPACITY_AT_MIN_RADIUS +
        (FILL_OPACITY_AT_MAX_RADIUS - FILL_OPACITY_AT_MIN_RADIUS) * opacityT;

      const isActive = bucket.bucketStartMs === activeBucketKey;
      const radius = isActive ? baseRadius * scale : baseRadius;
      const descriptor: ITradesVisibleBucket = {
        centerTimeDeltaMs: bucket.centerTimeDeltaMs,
        centerPriceDelta: bucket.centerPriceDelta,
        radiusPx: radius,
        buyFraction: bucket.buyFraction,
        fillOpacity,
      };
      if (isActive) {
        liftedBucket = descriptor;
      } else {
        visibleBuckets.push(descriptor);
      }
    }
    if (liftedBucket !== undefined) {
      visibleBuckets.push(liftedBucket);
    }

    const plotWidthPx = plotWidthDevicePx(ctx.canvasWidthPx, ctx.devicePixelRatio);

    this.frameState = {
      visibleBuckets,
      canvasWidth: ctx.canvasWidthPx,
      canvasHeight: ctx.canvasHeightPx,
      plotWidthPx,
      // The shader's view-window co-ordinate frame is already anchored
      // at `viewTimeStart`; keeping start at 0 / end at `(viewEnd -
      // viewStart)` lets the GPU stay in low-magnitude floats.
      viewTimeStartDeltaMs: 0,
      viewTimeEndDeltaMs: viewEndMs - viewStartMs,
      // Same anchoring trick on the price axis — descriptors carry
      // `vwap - priceMin`, the shader `priceMin` is 0.
      priceMin: 0,
      priceMax: priceMax - priceMin,
      devicePixelRatio: ctx.devicePixelRatio,
    };
  }

  writeGpuResources(_encoder: GPUCommandEncoder, _queue: GPUQueue): void {
    if (this.frameState === null) {
      return;
    }

    writeTradesUniforms(this.device, this.resources.uniformsBuffer, {
      canvasWidth: this.frameState.canvasWidth,
      canvasHeight: this.frameState.canvasHeight,
      plotWidthPx: this.frameState.plotWidthPx,
      viewTimeStartDeltaMs: this.frameState.viewTimeStartDeltaMs,
      viewTimeEndDeltaMs: this.frameState.viewTimeEndDeltaMs,
      priceMin: this.frameState.priceMin,
      priceMax: this.frameState.priceMax,
      devicePixelRatio: this.frameState.devicePixelRatio,
    });

    writeTradesBucketDescriptors(
      this.device,
      this.resources.descriptorsBuffer,
      this.frameState.visibleBuckets
    );
  }

  recordDrawCalls(pass: GPURenderPassEncoder): void {
    if (this.frameState === null || this.frameState.visibleBuckets.length === 0) {
      return;
    }
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(TRADES_VERTEX_COUNT_PER_INSTANCE, this.frameState.visibleBuckets.length, 0, 0);
  }

  dispose(): void {
    this.resources.uniformsBuffer.destroy();
    this.resources.descriptorsBuffer.destroy();
    this.blockDataByBlockId.clear();
    this.frameState = null;
    this.lastFrameStats = undefined;
  }
}

/**
 * Height of one price-step grid tick in device pixels. Used as the
 * unit for the per-bucket radius envelope so circles never visibly
 * exceed three vertical grid cells regardless of zoom level. Falls
 * back to a single device pixel on a degenerate viewport (zero price
 * range) — keeps `RADIUS_*_PRICE_TICK_MULT` math finite.
 */
function priceTickHeightInDevicePx(ctx: ILayerFrameContext): number {
  const priceRange = ctx.frameInput.priceMax - ctx.frameInput.priceMin;
  if (priceRange <= 0) {
    return 1;
  }
  return (ctx.frameInput.priceStep / priceRange) * ctx.canvasHeightPx;
}
