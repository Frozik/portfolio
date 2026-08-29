import { assert } from '@frozik/utils/assert/assert';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { isNil } from 'lodash-es';
import { drawChartAxes } from '../../domain/axis-draw/axes';
import { drawChartGrid } from '../../domain/axis-draw/grid';
import type { BlockDataPipeline } from '../../domain/block-data-pipeline';
import { BlockRegistry } from '../../domain/block-registry';
import {
  FPS_IDLE,
  FPS_RESIZE,
  FPS_ZOOM_ANIMATION,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD,
} from '../../domain/constants';
import type { IChartFrameLayout } from '../../domain/frame-layout';
import { FrameLayoutCache } from '../../domain/frame-layout';
import { computePlotGeometry } from '../../domain/plot-geometry';
import type { IChartViewport, ILoadingRegion, IPlotArea, ISeriesConfig } from '../../domain/types';
import {
  autoScaleY,
  scaleFromTimeRange,
  visibleValueRangeAcrossSeries,
} from '../../domain/viewport';
import { CanvasSizeTracker } from '../../infrastructure/canvas-size-tracker';
import { ChartInputController } from '../../infrastructure/chart-input';
import type { SeriesLayerManager } from '../../infrastructure/layers/series-layer-manager';
import { SlotAllocator } from '../../infrastructure/slot-allocator';
import { TextMeasureCache } from '../../infrastructure/text-measure-cache';
import { createSeries } from './series-factory';
import type { ISharedTimeseriesRenderer, ITimeseriesChart } from './types';

const INITIAL_VALUE_MIN = 0;
const INITIAL_VALUE_MAX = 200;
const MIN_POINTS_FOR_RENDERING = 2;

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
  private readonly canvasSize: CanvasSizeTracker;
  private readonly textCache = new TextMeasureCache();
  private readonly layoutCache = new FrameLayoutCache();

  private lastTextureCapacity = 0;

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

    this.registry = new BlockRegistry();
    this.allocator = new SlotAllocator(renderer.device, {
      onEvict: slot => {
        this.registry.removeBySlot(slot);
      },
    });

    this.lastTextureCapacity = this.allocator.getCapacity();

    const { dataPipelines, seriesManager } = createSeries({
      renderer,
      seriesConfigs,
      allocator: this.allocator,
      registry: this.registry,
      seed,
    });
    this.dataPipelines = dataPipelines;
    this.seriesManager = seriesManager;

    this.fpsController = new FpsController(FPS_IDLE);

    this.inputController = new ChartInputController(
      this.viewport,
      targetCanvas,
      this.dataMinTime,
      this.dataMaxTime,
      this.fpsController
    );
    this.inputController.attach();

    this.canvasSize = new CanvasSizeTracker(targetCanvas, (newWidth, previousWidth) => {
      this.springTimeAxis(newWidth, previousWidth);
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.canvasSize.measure();
      this.fpsController.raise(FPS_RESIZE);
    });
    this.resizeObserver.observe(targetCanvas);
  }

  get width(): number {
    return this.canvasSize.width;
  }

  get height(): number {
    return this.canvasSize.height;
  }

  syncCanvasSize(): boolean {
    return this.canvasSize.syncBackingStore();
  }

  update(): void {
    this.canvasSize.measure();

    if (this.inputController.applyInertia()) {
      this.fpsController.raise(FPS_ZOOM_ANIMATION);
    }

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

    for (const blocks of allBlockSets) {
      for (const block of blocks) {
        this.allocator.touch(block.slot);
      }
    }

    const valueRange = visibleValueRangeAcrossSeries(
      allBlockSets,
      this.viewport.viewTimeStart,
      this.viewport.viewTimeEnd
    );

    if (valueRange !== undefined) {
      const [yMin, yMax] = autoScaleY(valueRange[0], valueRange[1]);
      this.viewport.viewValueMin = yMin;
      this.viewport.viewValueMax = yMax;
    }

    const currentCapacity = this.allocator.getCapacity();
    if (currentCapacity !== this.lastTextureCapacity) {
      this.lastTextureCapacity = currentCapacity;
      this.rebuildLayerBindGroups();
    }

    this.seriesManager.writeAllUniforms(
      allBlockSets,
      this.canvasSize.width,
      this.canvasSize.height,
      this.viewport.viewTimeStart,
      this.viewport.viewTimeEnd,
      this.viewport.viewValueMin,
      this.viewport.viewValueMax
    );

    const geometry = computePlotGeometry(
      this.canvasSize.width,
      this.canvasSize.height,
      this.canvasSize.devicePixelRatio
    );

    return {
      x: Math.floor(geometry.left),
      y: Math.floor(geometry.top),
      width: Math.max(0, Math.floor(geometry.width)),
      height: Math.max(0, Math.floor(geometry.height)),
    };
  }

  renderCanvasAxes(): void {
    const layout = this.getFrameLayout();

    if (layout !== null) {
      drawChartAxes(this.target2dContext, layout, this.textCache);
    }
  }

  renderCanvasGrid(): void {
    const layout = this.getFrameLayout();

    if (layout !== null) {
      drawChartGrid(this.target2dContext, layout);
    }
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

  private getFrameLayout(): IChartFrameLayout | null {
    return this.layoutCache.getLayout(
      this.viewport,
      this.canvasSize.width,
      this.canvasSize.height,
      this.canvasSize.devicePixelRatio
    );
  }

  private rebuildLayerBindGroups(): void {
    this.seriesManager.updateBindGroups(this.allocator.createView());
  }

  /** Keep the visible time range proportional to the canvas width on resize. */
  private springTimeAxis(newWidth: number, previousWidth: number): void {
    const timeRange = this.viewport.viewTimeEnd - this.viewport.viewTimeStart;
    const springTimeRange = timeRange * (newWidth / previousWidth);
    const timeCenter = (this.viewport.viewTimeStart + this.viewport.viewTimeEnd) / 2;

    this.viewport.viewTimeStart = timeCenter - springTimeRange / 2;
    this.viewport.viewTimeEnd = timeCenter + springTimeRange / 2;
  }
}
