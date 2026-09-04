import { SCENE_BACKGROUND_COLOR } from '@frozik/utils/webgpu/backgroundColor';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { isNil } from 'lodash-es';
import type { BlockSpatialIndex } from '../../domain/block-store/block-spatial-index';
import type { ICandleBlockIndexItem, ICandleBlockRecord } from '../../domain/candle-types';
import { MSAA_SAMPLE_COUNT } from '../../domain/constants';
import type {
  IBlockFlushEvent,
  ICandleFlushEvent,
  ITradeBlockFlushEvent,
} from '../../domain/flush-events';
import { plotHeightDevicePx, plotWidthDevicePx } from '../../domain/math';
import type {
  ChartRendererInit,
  IChartCanvases,
  IChartRenderer,
  IChartRendererParams,
} from '../../domain/ports/chart-renderer';
import type { IRenderFrameInput } from '../../domain/render-frame-types';
import type { UnixTimeMs } from '../../domain/types';

import { drawAxisLabels } from './axis-draw/axis-overlay';
import { CandleLayer } from './candle-layer';
import { GridLayer } from './grid-layer';
import { HeatmapLayer } from './heatmap-layer';
import type { ILayerFrameContext, IRenderLayer } from './layer';
import type { IRendererResources } from './renderer-resources';
import { initRendererResources } from './renderer-resources';
import { TradesLayer } from './trades-layer';

const MIN_CANVAS_DIMENSION_PX = 1;
const MIN_DEVICE_PIXEL_RATIO = 1;

interface ICanvasSize {
  readonly width: number;
  readonly height: number;
}

/**
 * WebGPU adapter of the {@link IChartRenderer} port. The layer stack
 * (grid → heatmap → trades → candles → MA lines, then the hovered trade bucket on top)
 * renders straight into the chart
 * canvas; axis labels, the price panel and the crosshair are painted on
 * the transparent overlay canvas stacked above it.
 */
class BinanceChartRenderer implements IChartRenderer {
  private readonly canvases: IChartCanvases;
  private readonly device: GPUDevice;
  private readonly format: GPUTextureFormat;
  private readonly context: GPUCanvasContext;
  private readonly overlay2d: CanvasRenderingContext2D;
  private readonly scheduleFrames: IChartRendererParams['scheduleFrames'];
  private readonly readFrameInput: () => IRenderFrameInput;
  private readonly candleIndex: BlockSpatialIndex<ICandleBlockIndexItem>;
  private readonly msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  private readonly heatmapLayer: HeatmapLayer;
  private readonly candleLayer: CandleLayer;
  private readonly tradesLayer: TradesLayer;
  private readonly layers: readonly IRenderLayer[];

  private unscheduleFrames: VoidFunction | undefined = undefined;
  private disposed = false;

  constructor(params: IChartRendererParams, resources: IRendererResources) {
    this.canvases = params.canvases;
    this.device = resources.device;
    this.format = resources.format;
    this.context = resources.context;
    this.overlay2d = resources.overlay2d;
    this.scheduleFrames = params.scheduleFrames;
    this.readFrameInput = params.readFrameInput;
    this.candleIndex = params.candleIndex;

    const gridLayer = new GridLayer({
      device: resources.device,
      bindGroupLayout: resources.gridBindGroupLayout,
      pipeline: resources.gridPipeline,
    });
    this.heatmapLayer = new HeatmapLayer({
      device: resources.device,
      bindGroupLayout: resources.heatmapBindGroupLayout,
      pipeline: resources.heatmapPipeline,
      layout: resources.layout,
      registry: params.registry,
    });
    this.candleLayer = new CandleLayer({
      device: resources.device,
      bindGroupLayout: resources.candleBindGroupLayout,
      candlePipeline: resources.candlePipeline,
      movingAverageShortPipeline: resources.movingAverageShortPipeline,
      movingAverageLongPipeline: resources.movingAverageLongPipeline,
      candleIndex: params.candleIndex,
      requestBlocks: params.requestCandleBlocks,
    });
    this.tradesLayer = new TradesLayer({
      device: resources.device,
      bindGroupLayout: resources.tradesBindGroupLayout,
      volumeBarsPipeline: resources.volumeBarsPipeline,
      tradesIndex: params.tradesIndex,
    });
    this.layers = [gridLayer, this.heatmapLayer, this.tradesLayer, this.candleLayer];
  }

  start(): void {
    if (!isNil(this.unscheduleFrames) || this.disposed) {
      return;
    }
    this.unscheduleFrames = this.scheduleFrames(this.renderFrame);
  }

  writeFlushedSnapshots(event: IBlockFlushEvent): void {
    this.heatmapLayer.writeFlushedSnapshots(event);
  }

  writeFlushedCandles(event: ICandleFlushEvent): void {
    this.candleLayer.ingestFlush(event);
  }

  restoreCandleBlock(record: ICandleBlockRecord): void {
    this.candleLayer.restoreBlock(record);
  }

  writeFlushedTrades(event: ITradeBlockFlushEvent): void {
    this.tradesLayer.ingestFlush(event);
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.heatmapLayer.releaseBlockSlot(blockId);
  }

  releaseCandleBlockSlot(blockId: UnixTimeMs): void {
    this.candleLayer.releaseBlockSlot(blockId);
  }

  releaseTradesBlockSlot(blockId: UnixTimeMs): void {
    this.tradesLayer.releaseBlockSlot(blockId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unscheduleFrames?.();
    this.unscheduleFrames = undefined;
    for (const layer of this.layers) {
      layer.dispose();
    }
    this.msaaManager.dispose();
    this.context.unconfigure();
    this.device.destroy();
  }

  private readonly renderFrame = (): void => {
    if (this.disposed) {
      return;
    }
    const devicePixelRatio = Math.max(MIN_DEVICE_PIXEL_RATIO, window.devicePixelRatio);
    const { width, height } = this.syncCanvasSizes(devicePixelRatio);
    const frameInput = this.readFrameInput();

    const hasVisibleCandles =
      this.candleIndex.searchRange(frameInput.viewTimeStartMs, frameInput.viewTimeEndMs).length > 0;
    const context: ILayerFrameContext = {
      frameInput,
      canvasWidthPx: width,
      canvasHeightPx: height,
      plotWidthPx: plotWidthDevicePx(width, devicePixelRatio),
      plotHeightPx: plotHeightDevicePx(height, devicePixelRatio),
      devicePixelRatio,
      dimHeatmap: hasVisibleCandles,
      nowMs: performance.now(),
    };
    for (const layer of this.layers) {
      layer.computeFrameState(context);
    }

    this.renderLayers(context);

    this.overlay2d.clearRect(0, 0, width, height);
    drawAxisLabels({
      ...frameInput,
      ctx: this.overlay2d,
      canvasWidthPx: width,
      canvasHeightPx: height,
      devicePixelRatio,
    });
  };

  /**
   * Price-area layers are scissored to the plot rect so heatmap cells and candles outside
   * the price range never spill into the volume panel; the panel gets its own band.
   */
  private renderLayers(context: ILayerFrameContext): void {
    const { canvasWidthPx: width, canvasHeightPx: height } = context;
    const msaaView = this.msaaManager.ensureView(this.device, this.format, width, height);
    if (isNil(msaaView)) {
      return;
    }
    for (const layer of this.layers) {
      layer.writeGpuResources();
    }

    const encoder = this.device.createCommandEncoder({ label: 'binance.frame' });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: this.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: SCENE_BACKGROUND_COLOR,
          storeOp: 'discard',
        },
      ],
    });
    const plotWidth = Math.min(width, Math.round(context.plotWidthPx));
    const plotHeight = Math.min(height, Math.round(context.plotHeightPx));
    pass.setScissorRect(0, 0, plotWidth, plotHeight);
    for (const layer of this.layers) {
      layer.recordDrawCalls(pass);
    }
    pass.setScissorRect(0, plotHeight, plotWidth, height - plotHeight);
    this.tradesLayer.recordVolumePanelDrawCalls(pass);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  /** Both canvases share one backing-store size so overlay pixels sit exactly on chart pixels. */
  private syncCanvasSizes(devicePixelRatio: number): ICanvasSize {
    const rect = this.canvases.chartCanvas.getBoundingClientRect();
    const width = Math.max(MIN_CANVAS_DIMENSION_PX, Math.floor(rect.width * devicePixelRatio));
    const height = Math.max(MIN_CANVAS_DIMENSION_PX, Math.floor(rect.height * devicePixelRatio));

    for (const canvas of [this.canvases.chartCanvas, this.canvases.overlayCanvas]) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }
    return { width, height };
  }
}

export async function createBinanceChartRenderer(
  params: IChartRendererParams
): Promise<ChartRendererInit> {
  const init = await initRendererResources(params.canvases);
  if (init.kind === 'unsupported') {
    return init;
  }
  return { kind: 'ready', renderer: new BinanceChartRenderer(params, init.resources) };
}
