import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';

import type { BlockSpatialIndex } from '../domain/block-store/block-spatial-index';
import type { IHeatmapBlockIndexItem } from '../domain/block-store/create-heatmap-block-index';
import type { IMidPriceBlockIndexItem } from '../domain/block-store/create-mid-price-block-index';
import { MSAA_SAMPLE_COUNT } from '../domain/constants';
import type { IBlockFlushEventBridge } from '../domain/flush-bridge';
import type {
  FrameOverlayCallback,
  IMidPriceFlushEventBridge,
  IRenderFrameInput,
  ITradeBlockFlushEventBridge,
} from '../domain/render-frame-types';
import type { IViewportStats } from '../domain/trades-scaling';
import type { ITextureLayoutConfig, UnixTimeMs } from '../domain/types';
import { RenderTargetPool } from '../infrastructure/render-target-pool';
import type { TaskManager } from '../infrastructure/task-manager';
import {
  initRendererResources,
  OFFSCREEN_CTX_USAGE,
} from './binance-chart-renderer/init-resources';
import { HeatmapLayerRenderer } from './layers/heatmap-layer-renderer';
import type {
  ILayerChartStateView,
  ILayerFrameContext,
  ILayerRenderer,
  ITradesLayerStoreShape,
} from './layers/layer-renderer';
import { MidPriceLayerRenderer } from './layers/mid-price-layer-renderer';
import { TradesLayerRenderer } from './layers/trades-layer-renderer';

/**
 * The renderer takes a structural view of the chart state rather than
 * importing `BinanceChartState` directly — that import would close a
 * `chart-state → binance-chart-renderer → chart-state` cycle because
 * chart-state owns the renderer instance. The structural view exposes
 * only the read-only registries the renderer reads from.
 */
type BinanceChartState = ILayerChartStateView;

type HeatmapBlockRegistry = BlockSpatialIndex<IHeatmapBlockIndexItem>;
type MidPriceBlockIndex = BlockSpatialIndex<IMidPriceBlockIndexItem>;

// Shared WebGPU scene background colour used across every demo. The
// CPU-side Canvas2D layer is filled with this tone before the heatmap
// bitmap is composited on top, so the spread-gap between best-bid and
// best-ask reads as the same dark surface as sun / graphics / landing.
const CHART_BACKGROUND_COLOR = '#07090c';

export interface IRendererInitParams {
  readonly canvas: HTMLCanvasElement;
  readonly chartState: BinanceChartState;
  readonly registry: HeatmapBlockRegistry;
  readonly midPriceIndex: MidPriceBlockIndex;
  readonly taskManager: TaskManager;
  readonly updateSpeedMs: number;
  readonly priceStep: number;
}

interface IConstructorParams {
  readonly canvas: HTMLCanvasElement;
  readonly chartState: BinanceChartState;
  readonly registry: HeatmapBlockRegistry;
  readonly midPriceIndex: MidPriceBlockIndex;
  readonly taskManager: TaskManager;
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly offscreen: OffscreenCanvas;
  readonly context: GPUCanvasContext;
  readonly target2d: CanvasRenderingContext2D;
  readonly layout: ITextureLayoutConfig;
  readonly heatmapBindGroupLayout: GPUBindGroupLayout;
  readonly heatmapPipeline: GPURenderPipeline;
  readonly midPriceBindGroupLayout: GPUBindGroupLayout;
  readonly midPriceInteriorPipeline: GPURenderPipeline;
  readonly midPriceOutlinePipeline: GPURenderPipeline;
  readonly tradesBindGroupLayout: GPUBindGroupLayout;
  readonly tradesPipeline: GPURenderPipeline;
}

/**
 * Single-canvas WebGPU renderer for the Binance orderbook heatmap.
 *
 * Acts as the **orchestrator** for a stack of {@link ILayerRenderer}
 * instances (heatmap today, mid-price + trades incoming). Owns the
 * canvas, WebGPU device / queue, MSAA + render-target pools, and per-
 * frame command-encoder. Each frame the orchestrator:
 *
 *   1. Builds a single {@link ILayerFrameContext} from the registered
 *      frame-input source.
 *   2. Calls every layer's `computeFrameState` (only place observables
 *      are read).
 *   3. Calls every layer's `writeGpuResources` (only place GPU buffers
 *      are written).
 *   4. Begins one render pass and lets every layer append its draw
 *      calls in array order — keeps multi-layer batching cheap.
 *
 * Uses Approach D so the visible canvas can remain a 2D context while
 * still hosting a WebGPU heatmap: GPU renders into an OffscreenCanvas,
 * `transferToImageBitmap` extracts the frame, and `drawImage` blits it
 * onto the visible canvas between grid + label passes. Layer order:
 *
 *   fill background → drawGridUnder → drawImage(heatmap) → drawAxisLabels
 *
 * which keeps grid lines *under* the heatmap cells and axis labels on
 * top (so they stay legible regardless of cell colour).
 */
export class BinanceChartRenderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly layout: ITextureLayoutConfig;

  private readonly canvas: HTMLCanvasElement;
  private readonly chartState: BinanceChartState;
  private readonly taskManager: TaskManager;
  private readonly offscreen: OffscreenCanvas;
  private readonly context: GPUCanvasContext;
  private readonly target2d: CanvasRenderingContext2D;
  private readonly msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  private readonly renderTargetPool = new RenderTargetPool();

  private readonly heatmapLayer: HeatmapLayerRenderer;
  private readonly midPriceLayer: MidPriceLayerRenderer;
  private readonly tradesLayer: TradesLayerRenderer;

  private readonly layers: ReadonlyArray<ILayerRenderer>;
  private frameTaskUnsubscribe: (() => void) | undefined = undefined;
  private disposed = false;
  private needsReconfigure = false;
  private onFrameInput: (() => IRenderFrameInput) | null = null;
  private drawGridUnder: FrameOverlayCallback | null = null;
  private drawLabelsOver: FrameOverlayCallback | null = null;
  private tradesStoreView: ITradesLayerStoreShape | undefined = undefined;

  private constructor(params: IConstructorParams) {
    this.canvas = params.canvas;
    this.chartState = params.chartState;
    this.taskManager = params.taskManager;
    this.device = params.device;
    this.format = params.format;
    this.offscreen = params.offscreen;
    this.context = params.context;
    this.target2d = params.target2d;
    this.layout = params.layout;

    this.heatmapLayer = new HeatmapLayerRenderer({
      device: params.device,
      bindGroupLayout: params.heatmapBindGroupLayout,
      pipeline: params.heatmapPipeline,
      layout: params.layout,
      registry: params.registry,
    });

    this.midPriceLayer = new MidPriceLayerRenderer({
      device: params.device,
      bindGroupLayout: params.midPriceBindGroupLayout,
      interiorPipeline: params.midPriceInteriorPipeline,
      outlinePipeline: params.midPriceOutlinePipeline,
      midPriceIndex: params.midPriceIndex,
    });

    this.tradesLayer = new TradesLayerRenderer({
      device: params.device,
      bindGroupLayout: params.tradesBindGroupLayout,
      pipeline: params.tradesPipeline,
    });

    // Layer order is render order — heatmap goes first as the cell-
    // intensity backdrop, mid-price stamps the line on top, then
    // trade-bucket bubbles compose over both.
    this.layers = [this.heatmapLayer, this.midPriceLayer, this.tradesLayer];
  }

  static async create(params: IRendererInitParams): Promise<BinanceChartRenderer | null> {
    const resources = await initRendererResources(params.canvas);
    if (resources === null) {
      return null;
    }
    return new BinanceChartRenderer({
      canvas: params.canvas,
      chartState: params.chartState,
      registry: params.registry,
      midPriceIndex: params.midPriceIndex,
      taskManager: params.taskManager,
      ...resources,
    });
  }

  setFrameInputSource(source: () => IRenderFrameInput): void {
    this.onFrameInput = source;
  }

  setGridUnderCallback(callback: FrameOverlayCallback | null): void {
    this.drawGridUnder = callback;
  }

  setLabelsOverCallback(callback: FrameOverlayCallback | null): void {
    this.drawLabelsOver = callback;
  }

  /**
   * Register the trades-store view consulted by the trades layer once
   * per frame in `computeFrameState`. Owned by the orchestrator
   * (`BinanceViewStore`); the renderer only reads it through the
   * structural {@link ITradesLayerStoreShape} contract.
   */
  setTradesStore(view: ITradesLayerStoreShape | undefined): void {
    this.tradesStoreView = view;
  }

  start(): void {
    if (this.frameTaskUnsubscribe !== undefined || this.disposed) {
      return;
    }
    // The shared TaskManager already gates by the feature-level
    // FpsController — subscribing with `minIntervalMs: 0` means
    // "render on every scheduler tick" and lets the FPS level do the
    // throttling.
    this.frameTaskUnsubscribe = this.taskManager.subscribe(this.renderFrame, {
      minIntervalMs: 0,
    });
  }

  stop(): void {
    this.frameTaskUnsubscribe?.();
    this.frameTaskUnsubscribe = undefined;
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.heatmapLayer.releaseBlockSlot(blockId);
  }

  releaseMidPriceBlockSlot(blockId: UnixTimeMs): void {
    this.midPriceLayer.releaseBlockSlot(blockId);
  }

  releaseTradesBlockSlot(blockId: UnixTimeMs): void {
    this.tradesLayer.releaseBlockSlot(blockId);
  }

  /**
   * Read the trade layer's most recent per-frame `(vMin, vMax)` volume
   * envelope. Proxied here so the application-level
   * {@link BinanceChartState} can expose the same handle to the hit-test
   * resolver without the resolver reaching into the layer itself.
   */
  getTradesLayerLastFrameStats(): IViewportStats | undefined {
    return this.tradesLayer.getLastFrameStats();
  }

  /**
   * Upload new mid-price samples to the GPU texture and upsert the
   * corresponding entry into the mid-price index. Delegates to the
   * mid-price layer renderer which owns the texture row manager and
   * the spatial index entry shape.
   */
  writeFlushedMidPriceSamples(event: IMidPriceFlushEventBridge): void {
    this.midPriceLayer.ingestFlush(event);
  }

  writeFlushedSnapshots(event: IBlockFlushEventBridge): void {
    this.heatmapLayer.writeFlushedSnapshots(event);
  }

  /**
   * Hand the trade-block flush event's `Float32Array` reference to the
   * trades layer renderer. The trades spatial index is owned by
   * `BinanceChartState` (single-writer); this entry point only feeds
   * the layer's per-block descriptor cache so `computeFrameState` can
   * decode visible buckets.
   */
  writeFlushedTrades(event: ITradeBlockFlushEventBridge): void {
    this.tradesLayer.ingestFlush(event);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stop();
    for (const layer of this.layers) {
      layer.dispose();
    }
    this.msaaManager.dispose();
    this.renderTargetPool.dispose();
    this.device.destroy();
  }

  private syncCanvasSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return { width, height };
  }

  private readonly renderFrame = (): void => {
    if (this.disposed || this.onFrameInput === null) {
      return;
    }
    const { width, height } = this.syncCanvasSize();
    if (width === 0 || height === 0) {
      return;
    }

    const input = this.onFrameInput();
    const dpr = Math.max(1, window.devicePixelRatio);

    const ctx: ILayerFrameContext = {
      chartState: this.chartState,
      viewport: this.chartState.viewport,
      frameInput: input,
      canvasWidthPx: width,
      canvasHeightPx: height,
      devicePixelRatio: dpr,
      nowMs: performance.now(),
      tradesStore: this.tradesStoreView,
    };

    for (const layer of this.layers) {
      layer.computeFrameState(ctx);
    }

    const bitmap = this.renderOffscreenFrame(width, height);

    // Visible canvas composition: paint the grid first, then blit the
    // fully-opaque heatmap bitmap over it (the opaque render-pass
    // clear guarantees no sub-pixel alpha leaks), then axis labels on
    // top. The grid stays *under* the heatmap and is only visible
    // outside the cell quads if the bitmap ever leaves transparent
    // pixels — which it never does with the current clear colour.
    this.target2d.fillStyle = CHART_BACKGROUND_COLOR;
    this.target2d.fillRect(0, 0, width, height);
    this.invokeOverlay(this.drawGridUnder, width, height, input);
    if (bitmap !== null) {
      this.target2d.drawImage(bitmap, 0, 0);
      bitmap.close();
    }
    this.invokeOverlay(this.drawLabelsOver, width, height, input);
  };

  private renderOffscreenFrame(width: number, height: number): ImageBitmap | null {
    if (
      this.offscreen.width !== width ||
      this.offscreen.height !== height ||
      this.needsReconfigure
    ) {
      this.offscreen.width = width;
      this.offscreen.height = height;
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
        usage: OFFSCREEN_CTX_USAGE,
      });
      this.needsReconfigure = false;
    }

    const msaaView = this.msaaManager.ensureView(this.device, this.format, width, height);
    if (msaaView === null) {
      return null;
    }

    const renderTarget = this.renderTargetPool.acquire(this.device, width, height, this.format);
    const encoder = this.device.createCommandEncoder({ label: 'binance.frame' });

    // Layer phase 2: GPU resource writes. Each layer uploads its own
    // uniforms / descriptors / textures via the shared encoder + queue.
    for (const layer of this.layers) {
      layer.writeGpuResources(encoder, this.device.queue);
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: renderTarget.createView(),
          loadOp: 'clear',
          // Transparent clear so the grid painted under the bitmap
          // remains visible in the spread-gap between best-bid and
          // best-ask (and any other cell-free area). Cell quads
          // draw with alpha=1 and 0.5 px overdraw on each edge so
          // MSAA sub-pixel seams don't bleed the grid through.
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'discard',
        },
      ],
    });

    // Layer phase 3: draw calls. Heatmap goes first as the backdrop,
    // mid-price stamps the line on top.
    for (const layer of this.layers) {
      layer.recordDrawCalls(pass);
    }

    pass.end();

    const canvasTexture = this.context.getCurrentTexture();
    encoder.copyTextureToTexture({ texture: renderTarget }, { texture: canvasTexture }, [
      width,
      height,
    ]);
    this.device.queue.submit([encoder.finish()]);
    this.renderTargetPool.release(renderTarget);

    const bitmap = this.offscreen.transferToImageBitmap();
    this.needsReconfigure = true;
    return bitmap;
  }

  private invokeOverlay(
    callback: FrameOverlayCallback | null,
    width: number,
    height: number,
    frame: IRenderFrameInput
  ): void {
    if (callback === null) {
      return;
    }
    callback({
      ctx: this.target2d,
      canvasWidthPx: width,
      canvasHeightPx: height,
      devicePixelRatio: Math.max(1, window.devicePixelRatio),
      frame,
    });
  }
}
