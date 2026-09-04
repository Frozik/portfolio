import { assert } from '@frozik/utils/assert/assert';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import { isNil } from 'lodash-es';
import { createCandleBlockIndex } from '../domain/block-store/create-candle-block-index';
import { createHeatmapBlockIndex } from '../domain/block-store/create-heatmap-block-index';
import { createTradesBlockIndex } from '../domain/block-store/create-trades-block-index';
import type { ICandleBlockRecord } from '../domain/candle-types';
import type { DataController } from '../domain/data-controller';
import type {
  IBlockFlushEvent,
  ICandleFlushEvent,
  ITradeBlockFlushEvent,
} from '../domain/flush-events';
import { plotWidthCssPx } from '../domain/math';
import type {
  CreateChartRenderer,
  IChartCanvases,
  IChartRenderer,
} from '../domain/ports/chart-renderer';
import type { IRenderFrameInput } from '../domain/render-frame-types';
import type { IHeatmapViewport, UnixTimeMs } from '../domain/types';
import type { TaskManager } from '../infrastructure/task-manager';
import type {
  IViewportControllerParams,
  ViewportController,
} from '../infrastructure/viewport-controller';

export interface IChartStateDeps {
  readonly createRenderer: CreateChartRenderer;
  readonly createViewportController: (params: IViewportControllerParams) => ViewportController;
}

export interface IBinanceChartStateParams {
  readonly canvases: IChartCanvases;
  readonly pageOpenTimeMs: UnixTimeMs;
  readonly updateSpeedMs: number;
  readonly priceStep: number;
  /** Trade bucket under the cursor, owned by the trades store and read once per frame. */
  readonly readHoveredBucketKey: () => UnixTimeMs | undefined;
  /** Candle blocks the renderer found evicted from the texture; the candle store reloads them. */
  readonly requestCandleBlocks: (blockIds: readonly UnixTimeMs[]) => void;
  readonly deps: IChartStateDeps;
}

export interface IBinanceChartStateInitParams {
  readonly taskManager: TaskManager;
  readonly dataController: DataController;
}

interface IChartSession {
  readonly renderer: IChartRenderer;
  readonly viewportController: ViewportController;
}

const MIN_PLOT_WIDTH_PX = 1;

/**
 * Owns the spatial indexes of one chart and the session (renderer + viewport
 * controller) bound to its canvas. Flush events are forwarded to the renderer
 * and the viewport; the frame input is assembled here so the renderer never
 * touches controllers.
 */
export class BinanceChartState {
  /** The chart canvas: pointer input and CSS size are read from it. */
  readonly canvas: HTMLCanvasElement;
  private readonly canvases: IChartCanvases;
  readonly registry = createHeatmapBlockIndex();
  readonly candleIndex = createCandleBlockIndex();
  readonly tradesIndex = createTradesBlockIndex();

  private readonly pageOpenTimeMs: UnixTimeMs;
  private readonly updateSpeedMs: number;
  private readonly priceStep: number;
  private readonly readHoveredBucketKey: () => UnixTimeMs | undefined;
  private readonly requestCandleBlocks: (blockIds: readonly UnixTimeMs[]) => void;
  private readonly deps: IChartStateDeps;
  private session: IChartSession | undefined = undefined;

  constructor(params: IBinanceChartStateParams) {
    this.canvases = params.canvases;
    this.canvas = params.canvases.chartCanvas;
    this.pageOpenTimeMs = params.pageOpenTimeMs;
    this.updateSpeedMs = params.updateSpeedMs;
    this.priceStep = params.priceStep;
    this.readHoveredBucketKey = params.readHoveredBucketKey;
    this.requestCandleBlocks = params.requestCandleBlocks;
    this.deps = params.deps;
  }

  get viewport(): IHeatmapViewport {
    return this.requireSession().viewportController.viewport;
  }

  get viewportController(): ViewportController {
    return this.requireSession().viewportController;
  }

  /** Vertical price step used for cell sizing and the trade-bucket hit-test radius. */
  get currentPriceStep(): number {
    return this.priceStep;
  }

  /** Resolves to the failure reason when WebGPU cannot be brought up on this device. */
  async init(params: IBinanceChartStateInitParams): Promise<ValueDescriptorFail | undefined> {
    const init = await this.deps.createRenderer({
      canvases: this.canvases,
      registry: this.registry,
      candleIndex: this.candleIndex,
      tradesIndex: this.tradesIndex,
      scheduleFrames: renderFrame =>
        params.taskManager.subscribe(renderFrame, { minIntervalMs: 0 }),
      readFrameInput: this.provideFrameInput,
      requestCandleBlocks: this.requestCandleBlocks,
    });
    if (init.kind === 'unsupported') {
      return init.reason;
    }

    const viewportController = this.deps.createViewportController({
      canvas: this.canvas,
      taskManager: params.taskManager,
      pageOpenTimeMs: this.pageOpenTimeMs,
      priceStep: this.priceStep,
      getRegistry: () => this.registry,
      dataController: params.dataController,
    });

    this.session = { renderer: init.renderer, viewportController };
    init.renderer.start();
    return undefined;
  }

  ingestFlush(event: IBlockFlushEvent): void {
    const session = this.session;
    if (isNil(session)) {
      return;
    }
    session.renderer.writeFlushedSnapshots(event);
    session.viewportController.onFlushArrived({
      lastDisplayMs: event.block.lastTimestampMs,
      latestMagnitudeMin: event.latestMagnitudeMin,
      latestMagnitudeMax: event.latestMagnitudeMax,
    });
  }

  ingestCandleFlush(event: ICandleFlushEvent): void {
    this.session?.renderer.writeFlushedCandles(event);
  }

  restoreCandleBlock(record: ICandleBlockRecord): void {
    this.session?.renderer.restoreCandleBlock(record);
  }

  /** Feeds the renderer's descriptor cache and keeps the trades index (owned here) in step. */
  ingestTradesFlush(event: ITradeBlockFlushEvent): void {
    this.session?.renderer.writeFlushedTrades(event);
    const meta = event.block;
    this.tradesIndex.upsert({
      minX: meta.firstBucketStartMs,
      maxX: meta.lastBucketStartMs,
      minY: 0,
      maxY: 0,
      blockId: meta.blockId,
      textureRowIndex: undefined,
      bucketCount: meta.bucketCount,
      basePrice: meta.basePrice,
    });
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.session?.renderer.releaseBlockSlot(blockId);
  }

  releaseCandleBlockSlot(blockId: UnixTimeMs): void {
    this.session?.renderer.releaseCandleBlockSlot(blockId);
  }

  releaseTradesBlockSlot(blockId: UnixTimeMs): void {
    this.session?.renderer.releaseTradesBlockSlot(blockId);
    this.tradesIndex.remove(blockId);
  }

  dispose(): void {
    this.session?.viewportController.dispose();
    this.session?.renderer.dispose();
    this.session = undefined;
  }

  private requireSession(): IChartSession {
    assert(!isNil(this.session), 'BinanceChartState: accessed before init');
    return this.session;
  }

  private readonly provideFrameInput = (): IRenderFrameInput => {
    const { viewportController } = this.requireSession();
    viewportController.tick();
    const plotWidth = plotWidthCssPx(Math.max(MIN_PLOT_WIDTH_PX, this.canvas.clientWidth));
    const magnitude = viewportController.getMagnitudeRange();
    return {
      viewTimeStartMs: viewportController.viewTimeStartMsForPlotWidth(plotWidth),
      viewTimeEndMs: viewportController.viewport.viewTimeEndMs,
      priceMin: viewportController.viewport.priceMin,
      priceMax: viewportController.viewport.priceMax,
      magnitudeMin: magnitude.min,
      magnitudeMax: magnitude.max,
      priceStep: this.priceStep,
      timeStepMs: this.updateSpeedMs,
      cursorCss: viewportController.getCursorCss(),
      lastSnapshot: viewportController.getLastResolvedSnapshot(),
      hoveredBucketKey: this.readHoveredBucketKey(),
    };
  };
}
