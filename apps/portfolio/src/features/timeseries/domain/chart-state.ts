import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { computeXTicks, computeYTicks } from './axis-ticks';
import { BlockDataPipeline } from './block-data-pipeline';
import { BlockRegistry } from './block-registry';
import { renderAxes } from './chart-axes';
import { ChartInputController } from './chart-input';
import {
  AXIS_MARGIN_BOTTOM,
  AXIS_MARGIN_LEFT,
  AXIS_MARGIN_RIGHT,
  AXIS_MARGIN_TOP,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
  GRID_LINE_COLOR,
  VERTICES_PER_CANDLESTICK,
  VERTICES_PER_RHOMBUS,
  VERTICES_PER_SEGMENT,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD,
} from './constants';
import { EFpsLevel, FpsController } from './fps-controller';
import { SeriesLayer } from './layers/series-layer';
import { SeriesLayerManager } from './layers/series-layer-manager';
import { SlotAllocator } from './slot-allocator';
import type {
  IChartViewport,
  ILoadingRegion,
  IPlotArea,
  ISeriesConfig,
  ISharedTimeseriesRenderer,
  ITimeseriesChart,
} from './types';
import { EChartType } from './types';
import { autoScaleY, scaleFromTimeRange, visibleYRange } from './viewport';

const CHART_BACKGROUND_COLOR = '#1a1a1a';
const INITIAL_VALUE_MIN = 0;
const INITIAL_VALUE_MAX = 200;
const MIN_POINTS_FOR_RENDERING = 2;

function getVerticesPerInstance(chartType: EChartType): number {
  switch (chartType) {
    case EChartType.Line:
      return VERTICES_PER_SEGMENT;
    case EChartType.Candlestick:
      return VERTICES_PER_CANDLESTICK;
    case EChartType.Rhombus:
      return VERTICES_PER_RHOMBUS;
  }
}

function getNeedsStitching(chartType: EChartType): boolean {
  switch (chartType) {
    case EChartType.Line:
    case EChartType.Candlestick:
      return true;
    case EChartType.Rhombus:
      return false;
  }
}

function getGpuPipeline(
  chartType: EChartType,
  renderer: ISharedTimeseriesRenderer
): GPURenderPipeline {
  switch (chartType) {
    case EChartType.Line:
      return renderer.linePipeline;
    case EChartType.Candlestick:
      return renderer.candlestickPipeline;
    case EChartType.Rhombus:
      return renderer.rhombusPipeline;
  }
}

export class TimeseriesChartState implements ITimeseriesChart {
  readonly targetCanvas: HTMLCanvasElement;
  readonly target2dContext: CanvasRenderingContext2D;
  readonly axesSvg: SVGSVGElement;
  readonly seriesManager: SeriesLayerManager;
  readonly fpsController: FpsController;

  private readonly viewport: IChartViewport;
  private readonly dataMinTime: number;
  private readonly dataMaxTime: number;

  private readonly allocator: SlotAllocator;
  private readonly registry: BlockRegistry;
  private readonly dataPipelines: BlockDataPipeline[];

  private readonly inputController: ChartInputController;
  private readonly resizeObserver: ResizeObserver;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private lastTextureCapacity = 0;

  // Memoization: skip SVG re-render when viewport + size unchanged
  private lastOverlayTimeStart = Number.NaN;
  private lastOverlayTimeEnd = Number.NaN;
  private lastOverlayValueMin = Number.NaN;
  private lastOverlayValueMax = Number.NaN;
  private lastOverlayWidth = 0;
  private lastOverlayHeight = 0;

  constructor(
    device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    renderer: ISharedTimeseriesRenderer,
    seriesConfigs: readonly ISeriesConfig[],
    targetCanvas: HTMLCanvasElement,
    axesSvg: SVGSVGElement,
    initialTimeStart: number,
    initialTimeEnd: number,
    seed: string
  ) {
    this.targetCanvas = targetCanvas;
    this.axesSvg = axesSvg;

    const ctx = targetCanvas.getContext('2d');
    assert(!isNil(ctx), 'Failed to get 2D canvas context');
    this.target2dContext = ctx;

    this.dataMinTime = GLOBAL_EPOCH_OFFSET;
    this.dataMaxTime = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS;

    this.viewport = {
      viewTimeStart: initialTimeStart,
      viewTimeEnd: initialTimeEnd,
      targetTimeStart: initialTimeStart,
      targetTimeEnd: initialTimeEnd,
      viewValueMin: INITIAL_VALUE_MIN,
      viewValueMax: INITIAL_VALUE_MAX,
    };

    // Shared slot allocator (one texture) and block registry (one RTree)
    this.registry = new BlockRegistry();
    this.allocator = new SlotAllocator(device, undefined, undefined, undefined, slot => {
      this.registry.removeBySlot(slot);
    });

    this.lastTextureCapacity = this.allocator.getCapacity();

    // Create pipelines and layers from series configs
    this.dataPipelines = [];
    this.seriesManager = new SeriesLayerManager();

    for (const config of seriesConfigs) {
      const dataPipeline = new BlockDataPipeline(
        this.allocator,
        this.registry,
        `${seed}${config.seedSuffix}`,
        config.chartType,
        config.colorFn,
        config.sizeFn,
        () => renderer.debugMode
      );
      this.dataPipelines.push(dataPipeline);

      const layer = new SeriesLayer(
        getVerticesPerInstance(config.chartType),
        getNeedsStitching(config.chartType)
      );
      const gpuPipeline = getGpuPipeline(config.chartType, renderer);
      this.seriesManager.addSeries(layer, gpuPipeline);
    }

    this.seriesManager.initAll(device, bindGroupLayout, this.allocator);
    this.seriesManager.updateBindGroups(this.allocator.createView());

    this.fpsController = new FpsController();

    this.inputController = new ChartInputController(
      this.viewport,
      targetCanvas,
      this.dataMinTime,
      this.dataMaxTime,
      this.fpsController
    );
    this.inputController.attach();

    this.updateCanvasSize();

    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasSize();
      this.fpsController.raise(EFpsLevel.Resize);
      this.renderOverlay();
    });
    this.resizeObserver.observe(targetCanvas);
  }

  get width(): number {
    return this.canvasWidth;
  }

  get height(): number {
    return this.canvasHeight;
  }

  /** Sync canvas pixel dimensions to CSS size. Returns true if canvas was resized. */
  syncCanvasSize(): boolean {
    const dpr = Math.max(1, window.devicePixelRatio);
    const width = Math.floor(this.targetCanvas.clientWidth * dpr);
    const height = Math.floor(this.targetCanvas.clientHeight * dpr);

    this.canvasWidth = width;
    this.canvasHeight = height;

    if (this.targetCanvas.width !== width || this.targetCanvas.height !== height) {
      this.targetCanvas.width = width;
      this.targetCanvas.height = height;
      return true;
    }

    return false;
  }

  update(): void {
    this.updateCanvasSize();

    // Animate zoom: lerp current viewport toward target
    const dStart = this.viewport.targetTimeStart - this.viewport.viewTimeStart;
    const dEnd = this.viewport.targetTimeEnd - this.viewport.viewTimeEnd;
    const currentRange = this.viewport.viewTimeEnd - this.viewport.viewTimeStart;
    const threshold = currentRange * ZOOM_SNAP_THRESHOLD;

    if (Math.abs(dStart) > threshold || Math.abs(dEnd) > threshold) {
      this.viewport.viewTimeStart += dStart * ZOOM_LERP_SPEED;
      this.viewport.viewTimeEnd += dEnd * ZOOM_LERP_SPEED;
      this.fpsController.raise(EFpsLevel.ZoomAnimation);
    } else {
      this.viewport.viewTimeStart = this.viewport.targetTimeStart;
      this.viewport.viewTimeEnd = this.viewport.targetTimeEnd;
    }
  }

  prepareDrawCommands(): IPlotArea | null {
    const scale = scaleFromTimeRange(this.viewport.viewTimeStart, this.viewport.viewTimeEnd);

    // Ensure blocks for each series pipeline
    const allBlockSets = this.dataPipelines.map(pipeline =>
      pipeline.ensureBlocksForViewport(
        this.viewport.viewTimeStart,
        this.viewport.viewTimeEnd,
        scale
      )
    );

    // Keep FPS high while blocks are loading (for shimmer animation)
    if (this.getLoadingRegions().length > 0) {
      this.fpsController.raise(EFpsLevel.ZoomAnimation);
    }

    // Check if any series has enough points to render
    const hasAnyData = allBlockSets.some(blocks => {
      const totalPoints = blocks.reduce((sum, block) => sum + block.pointCount, 0);
      return totalPoints >= MIN_POINTS_FOR_RENDERING;
    });

    if (!hasAnyData) {
      // Still return plot area if there are loading regions (for loading bars)
      if (this.getLoadingRegions().length === 0) {
        return null;
      }
    }

    // Touch all visible blocks for LRU tracking
    for (const blocks of allBlockSets) {
      for (const block of blocks) {
        this.allocator.touch(block.slot);
      }
    }

    // Y auto-scale from all visible blocks
    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;

    for (const blocks of allBlockSets) {
      for (const block of blocks) {
        const range = visibleYRange(
          block.pointTimes,
          block.pointValues,
          this.viewport.viewTimeStart,
          this.viewport.viewTimeEnd
        );
        if (range !== undefined) {
          globalMin = Math.min(globalMin, range[0]);
          globalMax = Math.max(globalMax, range[1]);
        }
      }
    }

    if (globalMin < globalMax) {
      const [yMin, yMax] = autoScaleY(globalMin, globalMax);
      this.viewport.viewValueMin = yMin;
      this.viewport.viewValueMax = yMax;
    }

    // Rebuild bind groups if texture grew
    const currentCapacity = this.allocator.getCapacity();
    if (currentCapacity !== this.lastTextureCapacity) {
      this.lastTextureCapacity = currentCapacity;
      this.rebuildLayerBindGroups();
    }

    // Write uniforms for all series
    this.seriesManager.writeAllUniforms(
      allBlockSets,
      this.canvasWidth,
      this.canvasHeight,
      this.viewport.viewTimeStart,
      this.viewport.viewTimeEnd,
      this.viewport.viewValueMin,
      this.viewport.viewValueMax
    );

    const dpr = Math.max(1, window.devicePixelRatio);
    const plotX = Math.floor(AXIS_MARGIN_LEFT * dpr);
    const plotY = Math.floor(AXIS_MARGIN_TOP * dpr);
    const plotWidth = Math.max(
      0,
      this.canvasWidth - Math.floor((AXIS_MARGIN_LEFT + AXIS_MARGIN_RIGHT) * dpr)
    );
    const plotHeight = Math.max(
      0,
      this.canvasHeight - Math.floor((AXIS_MARGIN_TOP + AXIS_MARGIN_BOTTOM) * dpr)
    );

    return { x: plotX, y: plotY, width: plotWidth, height: plotHeight };
  }

  renderOverlay(): void {
    const { viewTimeStart, viewTimeEnd, viewValueMin, viewValueMax } = this.viewport;

    if (
      viewTimeStart === this.lastOverlayTimeStart &&
      viewTimeEnd === this.lastOverlayTimeEnd &&
      viewValueMin === this.lastOverlayValueMin &&
      viewValueMax === this.lastOverlayValueMax &&
      this.canvasWidth === this.lastOverlayWidth &&
      this.canvasHeight === this.lastOverlayHeight
    ) {
      return;
    }

    this.lastOverlayTimeStart = viewTimeStart;
    this.lastOverlayTimeEnd = viewTimeEnd;
    this.lastOverlayValueMin = viewValueMin;
    this.lastOverlayValueMax = viewValueMax;
    this.lastOverlayWidth = this.canvasWidth;
    this.lastOverlayHeight = this.canvasHeight;

    const dpr = Math.max(1, window.devicePixelRatio);
    const clientWidth = this.canvasWidth / dpr;
    const clientHeight = this.canvasHeight / dpr;

    renderAxes(this.axesSvg, this.viewport, clientWidth, clientHeight);
  }

  renderCanvasGrid(): void {
    const { viewTimeStart, viewTimeEnd, viewValueMin, viewValueMax } = this.viewport;
    const dpr = Math.max(1, window.devicePixelRatio);
    const ctx = this.target2dContext;

    const plotLeft = AXIS_MARGIN_LEFT * dpr;
    const plotTop = AXIS_MARGIN_TOP * dpr;
    const plotWidth = this.canvasWidth - (AXIS_MARGIN_LEFT + AXIS_MARGIN_RIGHT) * dpr;
    const plotHeight = this.canvasHeight - (AXIS_MARGIN_TOP + AXIS_MARGIN_BOTTOM) * dpr;
    const plotRight = plotLeft + plotWidth;
    const plotBottom = plotTop + plotHeight;

    if (plotWidth <= 0 || plotHeight <= 0) {
      return;
    }

    // Fill background — on iOS this is the underlay canvas below WebGPU
    ctx.fillStyle = CHART_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    const timeRange = viewTimeEnd - viewTimeStart;
    const valueRange = viewValueMax - viewValueMin;

    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = dpr * 0.5;
    ctx.beginPath();

    // Vertical grid lines
    const scale = scaleFromTimeRange(viewTimeStart, viewTimeEnd);
    const clientPlotWidth = plotWidth / dpr;
    const xTicks = computeXTicks(viewTimeStart, viewTimeEnd, scale, clientPlotWidth);

    for (const tick of xTicks) {
      const normalized = (tick.position - viewTimeStart) / timeRange;
      const pixelX = plotLeft + normalized * plotWidth;

      if (pixelX < plotLeft || pixelX > plotRight) {
        continue;
      }

      ctx.moveTo(pixelX, plotTop);
      ctx.lineTo(pixelX, plotBottom);
    }

    // Horizontal grid lines
    const clientPlotHeight = plotHeight / dpr;
    const yTicks = computeYTicks(viewValueMin, viewValueMax, clientPlotHeight);

    for (const tick of yTicks) {
      const normalized = (tick.position - viewValueMin) / valueRange;
      const pixelY = plotBottom - normalized * plotHeight;

      if (pixelY < plotTop || pixelY > plotBottom) {
        continue;
      }

      ctx.moveTo(plotLeft, pixelY);
      ctx.lineTo(plotRight, pixelY);
    }

    ctx.stroke();
  }

  getLoadingRegions(): ILoadingRegion[] {
    const regions: ILoadingRegion[] = [];
    for (const pipeline of this.dataPipelines) {
      regions.push(...pipeline.getLoadingRegions());
    }
    return regions;
  }

  getViewport(): { timeStart: number; timeEnd: number } {
    return {
      timeStart: this.viewport.viewTimeStart,
      timeEnd: this.viewport.viewTimeEnd,
    };
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.inputController.detach();
    this.seriesManager.dispose();
    this.allocator.dispose();
    this.fpsController.dispose();
  }

  private rebuildLayerBindGroups(): void {
    this.seriesManager.updateBindGroups(this.allocator.createView());
  }

  private updateCanvasSize(): void {
    const dpr = Math.max(1, window.devicePixelRatio);
    const newWidth = Math.floor(this.targetCanvas.clientWidth * dpr);

    const oldWidth = this.canvasWidth;

    this.canvasWidth = newWidth;
    this.canvasHeight = Math.floor(this.targetCanvas.clientHeight * dpr);

    // Spring effect on time axis
    if (oldWidth > 0 && newWidth !== oldWidth) {
      const timeRange = this.viewport.viewTimeEnd - this.viewport.viewTimeStart;
      const springTimeRange = timeRange * (newWidth / oldWidth);
      const timeCenter = (this.viewport.viewTimeStart + this.viewport.viewTimeEnd) / 2;

      this.viewport.viewTimeStart = timeCenter - springTimeRange / 2;
      this.viewport.viewTimeEnd = timeCenter + springTimeRange / 2;
    }
  }
}
