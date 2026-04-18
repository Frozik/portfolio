import { drawAxisLabels, drawGrid } from './axis-draw';
import { BlockRegistry } from './block-registry';
import type { DataController } from './data-controller';
import type { IBlockFlushEventBridge } from './flush-bridge';
import { plotWidthCssPx } from './math';
import { MidPriceBlockIndex } from './mid-price-block-index';
import type { IFrameOverlayInput, IMidPriceFlushEventBridge, IRenderFrameInput } from './renderer';
import { BinanceHeatmapRenderer } from './renderer';
import type { TaskManager } from './task-manager';
import type { UnixTimeMs } from './types';
import { ViewportController } from './viewport-controller';

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
  readonly registry = new BlockRegistry();
  readonly midPriceIndex = new MidPriceBlockIndex();

  private readonly pageOpenTimeMs: UnixTimeMs;
  private readonly updateSpeedMs: number;
  private priceStep: number;

  private renderer: BinanceHeatmapRenderer | null = null;
  private viewportControllerInternal: ViewportController | null = null;

  constructor(params: IBinanceChartStateParams) {
    this.canvas = params.canvas;
    this.pageOpenTimeMs = params.pageOpenTimeMs;
    this.updateSpeedMs = params.updateSpeedMs;
    this.priceStep = params.priceStep;
  }

  get viewport() {
    if (this.viewportControllerInternal === null) {
      throw new Error('BinanceChartState: viewport accessed before init');
    }
    return this.viewportControllerInternal.viewport;
  }

  get viewportController(): ViewportController {
    if (this.viewportControllerInternal === null) {
      throw new Error('BinanceChartState: viewportController accessed before init');
    }
    return this.viewportControllerInternal;
  }

  async init(params: IBinanceChartStateInitParams): Promise<boolean> {
    this.renderer = await BinanceHeatmapRenderer.create({
      canvas: this.canvas,
      registry: this.registry,
      midPriceIndex: this.midPriceIndex,
      taskManager: params.taskManager,
      updateSpeedMs: this.updateSpeedMs,
      priceStep: this.priceStep,
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

  setPriceStep(priceStep: number): void {
    this.priceStep = priceStep;
    this.viewportControllerInternal?.setPriceStep(priceStep);
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.renderer?.releaseBlockSlot(blockId);
  }

  releaseMidPriceBlockSlot(blockId: UnixTimeMs): void {
    this.renderer?.releaseMidPriceBlockSlot(blockId);
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
    if (this.viewportControllerInternal === null) {
      throw new Error('BinanceChartState: frame requested before init');
    }
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
