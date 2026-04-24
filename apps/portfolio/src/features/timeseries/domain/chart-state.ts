import { assert, FpsController } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { BlockDataPipeline } from './block-data-pipeline';
import { BlockRegistry } from './block-registry';
import { ChartInputController } from './chart-input';
import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  AXIS_LABEL_BG_COLOR,
  AXIS_LABEL_BG_PADDING_X,
  AXIS_LABEL_BG_PADDING_Y,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  AXIS_MARGIN_BOTTOM,
  AXIS_MARGIN_LEFT,
  AXIS_MARGIN_RIGHT,
  AXIS_MARGIN_TOP,
  FPS_IDLE,
  FPS_RESIZE,
  FPS_ZOOM_ANIMATION,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
  GRID_LINE_COLOR,
  TICK_LENGTH,
  VERTICES_PER_CANDLESTICK,
  VERTICES_PER_RHOMBUS,
  VERTICES_PER_SEGMENT,
  X_LABEL_Y_AXIS_CLEARANCE,
  Y_LABEL_X_AXIS_CLEARANCE,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD,
} from './constants';
import { SeriesLayer } from './layers/series-layer';
import { SeriesLayerManager } from './layers/series-layer-manager';
import { SlotAllocator } from './slot-allocator';
import { TextMeasureCache } from './text-measure-cache';
import { TickCache } from './tick-cache';
import type {
  ETimeScale,
  IAxisTick,
  IChartViewport,
  ILoadingRegion,
  IPlotArea,
  ISeriesConfig,
  ISharedTimeseriesRenderer,
  ITimeseriesChart,
} from './types';
import { EChartType } from './types';
import { autoScaleY, scaleFromTimeRange, visibleYRange } from './viewport';

/**
 * Cached per-frame geometry and tick data. Recomputed only when viewport
 * or canvas size changes — avoids redundant computeXTicks/computeYTicks
 * calls (which allocate Temporal objects and format strings) and plot
 * geometry recalculations across renderCanvasGrid + renderCanvasAxes.
 */
interface IFrameLayoutCache {
  // Cache keys — inputs that trigger recomputation
  timeStart: number;
  timeEnd: number;
  valueMin: number;
  valueMax: number;
  canvasWidth: number;
  canvasHeight: number;

  // Cached computed values
  dpr: number;
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
  plotRight: number;
  plotBottom: number;
  scale: ETimeScale;
  xTicks: IAxisTick[];
  yTicks: IAxisTick[];
}

const CHART_BACKGROUND_COLOR = '#07090c';
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

const LABEL_BG_RADIUS = 2;
const X_LABEL_GAP = 3;
const Y_LABEL_GAP = 4;

export class TimeseriesChartState implements ITimeseriesChart {
  readonly targetCanvas: HTMLCanvasElement;
  readonly target2dContext: CanvasRenderingContext2D;
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
  private readonly textCache = new TextMeasureCache();
  private readonly tickCache = new TickCache();

  private canvasWidth = 0;
  private canvasHeight = 0;
  private lastTextureCapacity = 0;
  private layoutCache: IFrameLayoutCache | null = null;

  constructor(
    renderer: ISharedTimeseriesRenderer,
    seriesConfigs: readonly ISeriesConfig[],
    targetCanvas: HTMLCanvasElement,
    initialTimeStart: number,
    initialTimeEnd: number,
    seed: string
  ) {
    this.targetCanvas = targetCanvas;

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
    this.allocator = new SlotAllocator(renderer.device, undefined, undefined, undefined, slot => {
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
        () => renderer.debugMode,
        () => renderer.instantLoad
      );
      this.dataPipelines.push(dataPipeline);

      const layer = new SeriesLayer(
        getVerticesPerInstance(config.chartType),
        getNeedsStitching(config.chartType)
      );
      const gpuPipeline = getGpuPipeline(config.chartType, renderer);
      this.seriesManager.addSeries(layer, gpuPipeline);
    }

    this.seriesManager.initAll(renderer.device, renderer.bindGroupLayout, this.allocator);
    this.seriesManager.updateBindGroups(this.allocator.createView());

    this.fpsController = new FpsController(FPS_IDLE);

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
      this.fpsController.raise(FPS_RESIZE);
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

    // Apply pan inertia (decaying velocity after pointer release)
    if (this.inputController.applyInertia()) {
      this.fpsController.raise(FPS_ZOOM_ANIMATION);
    }

    // Animate zoom: lerp current viewport toward target
    const dStart = this.viewport.targetTimeStart - this.viewport.viewTimeStart;
    const dEnd = this.viewport.targetTimeEnd - this.viewport.viewTimeEnd;
    const currentRange = this.viewport.viewTimeEnd - this.viewport.viewTimeStart;
    const threshold = currentRange * ZOOM_SNAP_THRESHOLD;

    if (Math.abs(dStart) > threshold || Math.abs(dEnd) > threshold) {
      this.viewport.viewTimeStart += dStart * ZOOM_LERP_SPEED;
      this.viewport.viewTimeEnd += dEnd * ZOOM_LERP_SPEED;
      this.fpsController.raise(FPS_ZOOM_ANIMATION);
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
      this.fpsController.raise(FPS_ZOOM_ANIMATION);
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

  /**
   * Computes or returns cached layout: plot geometry, scale, and axis ticks.
   * Recomputed only when viewport or canvas size changes — saves ~2-4ms/frame
   * by avoiding redundant computeXTicks/computeYTicks calls (Temporal objects,
   * string formatting, tick thinning) across renderCanvasGrid + renderCanvasAxes.
   */
  private getFrameLayout(): IFrameLayoutCache | null {
    const { viewTimeStart, viewTimeEnd, viewValueMin, viewValueMax } = this.viewport;
    const dpr = Math.max(1, window.devicePixelRatio);

    const cache = this.layoutCache;

    if (
      cache !== null &&
      cache.timeStart === viewTimeStart &&
      cache.timeEnd === viewTimeEnd &&
      cache.valueMin === viewValueMin &&
      cache.valueMax === viewValueMax &&
      cache.canvasWidth === this.canvasWidth &&
      cache.canvasHeight === this.canvasHeight
    ) {
      return cache;
    }

    const plotLeft = AXIS_MARGIN_LEFT * dpr;
    const plotTop = AXIS_MARGIN_TOP * dpr;
    const plotWidth = this.canvasWidth - (AXIS_MARGIN_LEFT + AXIS_MARGIN_RIGHT) * dpr;
    const plotHeight = this.canvasHeight - (AXIS_MARGIN_TOP + AXIS_MARGIN_BOTTOM) * dpr;

    if (plotWidth <= 0 || plotHeight <= 0) {
      this.layoutCache = null;
      return null;
    }

    const scale = scaleFromTimeRange(viewTimeStart, viewTimeEnd);
    const clientPlotWidth = plotWidth / dpr;
    const clientPlotHeight = plotHeight / dpr;

    this.layoutCache = {
      timeStart: viewTimeStart,
      timeEnd: viewTimeEnd,
      valueMin: viewValueMin,
      valueMax: viewValueMax,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      dpr,
      plotLeft,
      plotTop,
      plotWidth,
      plotHeight,
      plotRight: plotLeft + plotWidth,
      plotBottom: plotTop + plotHeight,
      scale,
      xTicks: this.tickCache.getXTicks(viewTimeStart, viewTimeEnd, scale, clientPlotWidth),
      yTicks: this.tickCache.getYTicks(viewValueMin, viewValueMax, clientPlotHeight),
    };

    return this.layoutCache;
  }

  renderCanvasAxes(): void {
    const layout = this.getFrameLayout();

    if (layout === null) {
      return;
    }

    const { dpr, plotLeft, plotTop, plotRight, plotBottom, plotWidth, plotHeight, xTicks, yTicks } =
      layout;
    const ctx = this.target2dContext;
    const timeRange = layout.timeEnd - layout.timeStart;
    const valueRange = layout.valueMax - layout.valueMin;

    const fontSize = AXIS_FONT_SIZE * dpr;
    const tickLength = TICK_LENGTH * dpr;
    const bgPaddingX = AXIS_LABEL_BG_PADDING_X * dpr;
    const bgPaddingY = AXIS_LABEL_BG_PADDING_Y * dpr;
    const bgRadius = LABEL_BG_RADIUS * dpr;
    const xLabelGap = X_LABEL_GAP * dpr;
    const yLabelGap = Y_LABEL_GAP * dpr;
    const xClearance = X_LABEL_Y_AXIS_CLEARANCE * dpr;
    const yClearance = Y_LABEL_X_AXIS_CLEARANCE * dpr;

    // Axis lines (L-shape: left edge top→bottom, then bottom edge left→right)
    ctx.strokeStyle = AXIS_LINE_COLOR;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    ctx.font = `${fontSize}px ${AXIS_FONT_FAMILY}`;
    ctx.textBaseline = 'alphabetic';

    // Glyph metrics cached per font size — avoids measureText('0') every frame.
    // Uses 'alphabetic' baseline + measured centerOffset for true visual centering
    // (Canvas 'middle' baseline sits too high for digit-only labels).
    const { centerOffset: glyphCenterOffset } = this.textCache.getGlyphMetrics(ctx);

    // X-axis ticks + labels
    for (const tick of xTicks) {
      const normalized = (tick.position - layout.timeStart) / timeRange;
      const pixelX = plotLeft + normalized * plotWidth;

      if (pixelX < plotLeft || pixelX > plotRight) {
        continue;
      }

      // Tick mark
      ctx.strokeStyle = AXIS_LINE_COLOR;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(pixelX, plotBottom);
      ctx.lineTo(pixelX, plotBottom - tickLength);
      ctx.stroke();

      // Label positioning
      const textWidth = this.textCache.measureWidth(ctx, tick.label);
      const labelLeft = pixelX - textWidth / 2 - bgPaddingX;

      // Skip if too close to Y-axis
      if (labelLeft < plotLeft + xClearance) {
        continue;
      }

      const labelCenterY = plotBottom - tickLength - xLabelGap - fontSize / 2;
      const boxHeight = fontSize + bgPaddingY * 2;

      // Background rect
      ctx.fillStyle = AXIS_LABEL_BG_COLOR;
      ctx.beginPath();
      ctx.roundRect(
        pixelX - textWidth / 2 - bgPaddingX,
        labelCenterY - boxHeight / 2,
        textWidth + bgPaddingX * 2,
        boxHeight,
        bgRadius
      );
      ctx.fill();

      // Label text
      ctx.fillStyle = AXIS_LABEL_COLOR;
      ctx.textAlign = 'center';
      ctx.fillText(tick.label, pixelX, labelCenterY + glyphCenterOffset);
    }

    // Y-axis ticks + labels
    for (const tick of yTicks) {
      const normalized = (tick.position - layout.valueMin) / valueRange;
      const pixelY = plotBottom - normalized * plotHeight;

      if (pixelY < plotTop || pixelY > plotBottom) {
        continue;
      }

      // Tick mark
      ctx.strokeStyle = AXIS_LINE_COLOR;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(plotLeft, pixelY);
      ctx.lineTo(plotLeft + tickLength, pixelY);
      ctx.stroke();

      // Label positioning — center vertically on tick mark
      const labelX = plotLeft + tickLength + yLabelGap;
      const labelCenterY = pixelY;
      const boxHeight = fontSize + bgPaddingY * 2;

      // Skip if too close to X-axis
      if (labelCenterY + boxHeight / 2 > plotBottom - yClearance) {
        continue;
      }

      const textWidth = this.textCache.measureWidth(ctx, tick.label);

      // Background rect
      ctx.fillStyle = AXIS_LABEL_BG_COLOR;
      ctx.beginPath();
      ctx.roundRect(
        labelX - bgPaddingX,
        labelCenterY - boxHeight / 2,
        textWidth + bgPaddingX * 2,
        boxHeight,
        bgRadius
      );
      ctx.fill();

      // Label text
      ctx.fillStyle = AXIS_LABEL_COLOR;
      ctx.textAlign = 'start';
      ctx.fillText(tick.label, labelX, labelCenterY + glyphCenterOffset);
    }
  }

  renderCanvasGrid(): void {
    const layout = this.getFrameLayout();

    if (layout === null) {
      return;
    }

    const { dpr, plotLeft, plotTop, plotRight, plotBottom, plotWidth, plotHeight, xTicks, yTicks } =
      layout;
    const ctx = this.target2dContext;
    const timeRange = layout.timeEnd - layout.timeStart;
    const valueRange = layout.valueMax - layout.valueMin;

    // Fill background
    ctx.fillStyle = CHART_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = dpr * 0.5;
    ctx.setLineDash([10 * dpr, 10 * dpr]);
    ctx.beginPath();

    // Vertical grid lines
    for (const tick of xTicks) {
      const normalized = (tick.position - layout.timeStart) / timeRange;
      const pixelX = plotLeft + normalized * plotWidth;

      if (pixelX < plotLeft || pixelX > plotRight) {
        continue;
      }

      ctx.moveTo(pixelX, plotTop);
      ctx.lineTo(pixelX, plotBottom);
    }

    // Horizontal grid lines
    for (const tick of yTicks) {
      const normalized = (tick.position - layout.valueMin) / valueRange;
      const pixelY = plotBottom - normalized * plotHeight;

      if (pixelY < plotTop || pixelY > plotBottom) {
        continue;
      }

      ctx.moveTo(plotLeft, pixelY);
      ctx.lineTo(plotRight, pixelY);
    }

    ctx.stroke();
    ctx.setLineDash([]);
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
