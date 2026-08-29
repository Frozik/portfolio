import { assert } from '@frozik/utils/assert/assert';

import { drawAxisLabels, drawGrid } from '../domain/axis-draw';
import { createHeatmapBlockIndex } from '../domain/block-store/create-heatmap-block-index';
import { createMidPriceBlockIndex } from '../domain/block-store/create-mid-price-block-index';
import { createTradesBlockIndex } from '../domain/block-store/create-trades-block-index';
import type { DataController } from '../domain/data-controller';
import type { IBlockFlushEventBridge } from '../domain/flush-bridge';
import { plotWidthCssPx } from '../domain/math';
import type {
  IFrameOverlayInput,
  IMidPriceFlushEventBridge,
  IRenderFrameInput,
  ITradeBlockFlushEventBridge,
} from '../domain/render-frame-types';
import type { IViewportStats } from '../domain/trades-scaling';
import type { IHeatmapViewport, UnixTimeMs } from '../domain/types';
import type { TaskManager } from '../infrastructure/task-manager';
import { ViewportController } from '../infrastructure/viewport-controller';
import { BinanceChartRenderer } from './binance-chart-renderer';
import type { ITradesLayerStoreShape } from './layers/layer-renderer';

export interface IBinanceChartStateParams {
  readonly canvas: HTMLCanvasElement;
  readonly pageOpenTimeMs: UnixTimeMs;
  readonly updateSpeedMs: number;
  readonly priceStep: number;
}

export interface IBinanceChartStateInitParams {
  /** Shared scheduler used by ViewportController's auto-centering task. */
  readonly taskManager: TaskManager;
  /** Snapshot source consulted by ViewportController to derive the target mid-price. */
  readonly dataController: DataController;
}

/**
 * Orchestrates the heatmap for one canvas.
 *
 * Owns the RBush registry and the WebGPU renderer; delegates every
 * piece of viewport / input / follow-mode / zoom state to
 * {@link ViewportController}. `ingestFlush` funnels new data into the
 * renderer and surfaces the latest magnitude bounds and
 * `lastDisplayMs` to the viewport controller.
 *
 * Y-axis centering lives inside {@link ViewportController} — it
 * subscribes to the shared `TaskManager` and pulls the rightmost
 * snapshot from `DataController` at a fixed cadence.
 */
export class BinanceChartState {
  readonly canvas: HTMLCanvasElement;
  readonly registry = createHeatmapBlockIndex();
  readonly midPriceIndex = createMidPriceBlockIndex();
  readonly tradesIndex = createTradesBlockIndex();

  private readonly pageOpenTimeMs: UnixTimeMs;
  private readonly updateSpeedMs: number;
  private readonly priceStep: number;

  private renderer: BinanceChartRenderer | null = null;
  private viewportControllerInternal: ViewportController | null = null;

  constructor(params: IBinanceChartStateParams) {
    this.canvas = params.canvas;
    this.pageOpenTimeMs = params.pageOpenTimeMs;
    this.updateSpeedMs = params.updateSpeedMs;
    this.priceStep = params.priceStep;
  }

  get viewport(): IHeatmapViewport {
    assert(
      this.viewportControllerInternal !== null,
      'BinanceChartState: viewport accessed before init'
    );
    return this.viewportControllerInternal.viewport;
  }

  get viewportController(): ViewportController {
    assert(
      this.viewportControllerInternal !== null,
      'BinanceChartState: viewportController accessed before init'
    );
    return this.viewportControllerInternal;
  }

  /**
   * Vertical price step used for cell sizing — exposed so the
   * presentation layer can size the trade-bucket hit-test floor radius
   * (`priceStep / priceRange × canvasHeightPx`) without dereferencing
   * the renderer's frame input.
   */
  get currentPriceStep(): number {
    return this.priceStep;
  }

  async init(params: IBinanceChartStateInitParams): Promise<boolean> {
    this.renderer = await BinanceChartRenderer.create({
      canvas: this.canvas,
      registry: this.registry,
      midPriceIndex: this.midPriceIndex,
      taskManager: params.taskManager,
      updateSpeedMs: this.updateSpeedMs,
      priceStep: this.priceStep,
      chartState: this,
    });

    if (this.renderer === null) {
      return false;
    }

    this.viewportControllerInternal = new ViewportController({
      canvas: this.canvas,
      taskManager: params.taskManager,
      pageOpenTimeMs: this.pageOpenTimeMs,
      priceStep: this.priceStep,
      getRegistry: () => this.registry,
      dataController: params.dataController,
    });

    this.renderer.setFrameInputSource(this.provideFrameInput);
    this.renderer.setGridUnderCallback(this.drawGridUnder);
    this.renderer.setLabelsOverCallback(this.drawLabelsOver);
    this.renderer.start();
    return true;
  }

  ingestFlush(event: IBlockFlushEventBridge): void {
    if (this.renderer === null || this.viewportControllerInternal === null) {
      return;
    }
    this.renderer.writeFlushedSnapshots(event);
    this.viewportControllerInternal.onFlushArrived({
      lastDisplayMs: event.block.lastTimestampMs,
      latestMagnitudeMin: event.latestMagnitudeMin,
      latestMagnitudeMax: event.latestMagnitudeMax,
    });
  }

  ingestMidPriceFlush(event: IMidPriceFlushEventBridge): void {
    this.renderer?.writeFlushedMidPriceSamples(event);
  }

  /**
   * Single-writer entrypoint for the trades layer: forwards the
   * block's `Float32Array` reference into the layer's descriptor
   * cache (via the renderer) and upserts the matching `tradesIndex`
   * entry. Mirrors `ingestMidPriceFlush` but keeps the index upsert
   * at the chart-state layer so the trades layer renderer doesn't own
   * the spatial index — see `trades-layer-renderer.ts` for the
   * single-writer rationale.
   */
  ingestTradesFlush(event: ITradeBlockFlushEventBridge): void {
    this.renderer?.writeFlushedTrades(event);
    const meta = event.block;
    this.tradesIndex.upsert({
      minX: meta.firstBucketStartMs,
      maxX: meta.lastBucketStartMs,
      minY: 0,
      maxY: 0,
      blockId: meta.blockId,
      textureRowIndex: meta.textureRowIndex,
      bucketCount: meta.bucketCount,
      basePrice: meta.basePrice,
    });
  }

  /**
   * Forward observable trades-store handle to the renderer so the
   * trades layer can read `hoveredBucketKey` once per frame in
   * `computeFrameState`. Called by the orchestrator
   * (`BinanceViewStore.attachCanvas`) once the trades store has been
   * constructed.
   */
  setTradesStore(view: ITradesLayerStoreShape | undefined): void {
    this.renderer?.setTradesStore(view);
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.renderer?.releaseBlockSlot(blockId);
  }

  releaseMidPriceBlockSlot(blockId: UnixTimeMs): void {
    this.renderer?.releaseMidPriceBlockSlot(blockId);
  }

  /**
   * Drop the trade-block's GPU descriptor cache + its `tradesIndex`
   * entry. Called by the orchestrator (via `TradesStreamStore`) when
   * the rolling window evicts a block past `MAX_TRADE_BLOCKS_IN_RAM`.
   */
  releaseTradesBlockSlot(blockId: UnixTimeMs): void {
    this.renderer?.releaseTradesBlockSlot(blockId);
    this.tradesIndex.remove(blockId);
  }

  /**
   * Read the trade layer's most recent per-frame `(vMin, vMax)` volume
   * envelope from the renderer. Used by `TradesStreamStore.findBucketAt`
   * to derive hit-test radii using the same envelope the renderer used
   * this frame — keeps the click hit-zone congruent with the rendered
   * radius envelope across all scaling modes.
   */
  getTradesLayerLastFrameStats(): IViewportStats | undefined {
    return this.renderer?.getTradesLayerLastFrameStats();
  }

  dispose(): void {
    this.viewportControllerInternal?.dispose();
    this.viewportControllerInternal = null;
    this.renderer?.dispose();
    this.renderer = null;
  }

  private readonly drawGridUnder = (input: IFrameOverlayInput): void => {
    drawGrid({
      ctx: input.ctx,
      canvasWidthPx: input.canvasWidthPx,
      canvasHeightPx: input.canvasHeightPx,
      devicePixelRatio: input.devicePixelRatio,
      viewTimeStartMs: input.frame.viewTimeStartMs,
      viewTimeEndMs: input.frame.viewTimeEndMs,
      priceMin: input.frame.priceMin,
      priceMax: input.frame.priceMax,
      priceStep: input.frame.priceStep,
    });
  };

  private readonly drawLabelsOver = (input: IFrameOverlayInput): void => {
    drawAxisLabels({
      ctx: input.ctx,
      canvasWidthPx: input.canvasWidthPx,
      canvasHeightPx: input.canvasHeightPx,
      devicePixelRatio: input.devicePixelRatio,
      viewTimeStartMs: input.frame.viewTimeStartMs,
      viewTimeEndMs: input.frame.viewTimeEndMs,
      priceMin: input.frame.priceMin,
      priceMax: input.frame.priceMax,
      priceStep: input.frame.priceStep,
      cursorCss: input.frame.cursorCss,
      lastSnapshot: input.frame.lastSnapshot,
    });
  };

  private readonly provideFrameInput = (): IRenderFrameInput => {
    assert(
      this.viewportControllerInternal !== null,
      'BinanceChartState: frame requested before init'
    );
    this.viewportControllerInternal.tick();
    const plotWidth = plotWidthCssPx(Math.max(1, this.canvas.clientWidth));
    const startMs = this.viewportControllerInternal.viewTimeStartMsForPlotWidth(plotWidth);
    return {
      viewTimeStartMs: startMs,
      viewTimeEndMs: this.viewportControllerInternal.viewport.viewTimeEndMs,
      priceMin: this.viewportControllerInternal.viewport.priceMin,
      priceMax: this.viewportControllerInternal.viewport.priceMax,
      magnitudeMin: this.viewportControllerInternal.getMagnitudeMin(),
      magnitudeMax: this.viewportControllerInternal.getMagnitudeMax(),
      priceStep: this.priceStep,
      timeStepMs: this.updateSpeedMs,
      cursorCss: this.viewportControllerInternal.getCursorCss(),
      lastSnapshot: this.viewportControllerInternal.getLastResolvedSnapshot(),
    };
  };
}
