import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import { isNil } from 'lodash-es';

import type { BlockDataPipeline } from '../../domain/block-data-pipeline';
import {
  FPS_RESIZE,
  FPS_ZOOM_ANIMATION,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD,
} from '../../domain/constants';
import type { FrameLayoutCache, IChartFrameLayout } from '../../domain/frame-layout';
import { computePlotGeometry } from '../../domain/plot-geometry';
import type { ITextMeasurer } from '../../domain/text-measurer';
import type { ILoadingRegion, IPlotArea } from '../../domain/types';
import {
  autoScaleY,
  scaleFromTimeRange,
  visibleValueRangeAcrossSeries,
} from '../../domain/viewport';
import { drawChartAxes } from '../../infrastructure/canvas-draw/axes';
import { drawChartGrid } from '../../infrastructure/canvas-draw/grid';
import { drawLoadingBars } from '../../infrastructure/canvas-draw/loading-bars';
import type { CanvasSizeTracker } from '../../infrastructure/canvas-size-tracker';
import type { ChartInputController } from '../../infrastructure/chart-input';
import type { ISeriesLayerManager } from '../../infrastructure/layers/types';
import type { SlotAllocator } from '../../infrastructure/slot-allocator';
import type { ITimeseriesChart } from './types';
import type { ViewportState } from './viewport-state';

const MIN_POINTS_FOR_RENDERING = 2;

/** Everything a chart is made of; assembled by `createTimeseriesChart`. */
export interface ITimeseriesChartDeps {
  readonly target2dContext: CanvasRenderingContext2D;
  readonly viewport: ViewportState;
  readonly canvasSize: CanvasSizeTracker;
  readonly inputController: ChartInputController;
  readonly fpsController: FpsController;
  readonly allocator: SlotAllocator;
  readonly dataPipelines: readonly BlockDataPipeline[];
  readonly seriesManager: ISeriesLayerManager;
  readonly textMeasurer: ITextMeasurer;
  readonly layoutCache: FrameLayoutCache;
  /** Torn down with the chart: observers and listeners the factory attached. */
  readonly dispose: VoidFunction;
}

/**
 * One chart of the grid: advances the zoom animation, keeps the visible
 * blocks resident, autoscales the value axis and paints grid, GPU image and
 * axes onto its 2D canvas.
 */
export class TimeseriesChartState implements ITimeseriesChart {
  private lastTextureCapacity: number;

  constructor(private readonly deps: ITimeseriesChartDeps) {
    this.lastTextureCapacity = deps.allocator.getCapacity();
  }

  get width(): number {
    return this.deps.canvasSize.width;
  }

  get height(): number {
    return this.deps.canvasSize.height;
  }

  get frameIntervalMs(): number {
    return this.deps.fpsController.getFrameIntervalMs();
  }

  tickFps(): void {
    this.deps.fpsController.tick();
  }

  update(): void {
    const { canvasSize, inputController, fpsController, viewport } = this.deps;
    canvasSize.measure();
    if (inputController.applyInertia()) {
      fpsController.raise(FPS_ZOOM_ANIMATION);
    }

    const { viewTimeStart, viewTimeEnd, targetTimeStart, targetTimeEnd } = viewport.current;
    const deltaStart = targetTimeStart - viewTimeStart;
    const deltaEnd = targetTimeEnd - viewTimeEnd;
    const snapThreshold = (viewTimeEnd - viewTimeStart) * ZOOM_SNAP_THRESHOLD;
    if (Math.abs(deltaStart) > snapThreshold || Math.abs(deltaEnd) > snapThreshold) {
      viewport.update({
        viewTimeStart: viewTimeStart + deltaStart * ZOOM_LERP_SPEED,
        viewTimeEnd: viewTimeEnd + deltaEnd * ZOOM_LERP_SPEED,
      });
      fpsController.raise(FPS_ZOOM_ANIMATION);
    } else {
      viewport.update({ viewTimeStart: targetTimeStart, viewTimeEnd: targetTimeEnd });
    }
  }

  prepareFrame(): IPlotArea | undefined {
    const { viewport, dataPipelines, fpsController, allocator, seriesManager, canvasSize } =
      this.deps;
    const { viewTimeStart, viewTimeEnd } = viewport.current;
    const scale = scaleFromTimeRange(viewTimeStart, viewTimeEnd);
    const allBlockSets = dataPipelines.map(pipeline =>
      pipeline.ensureBlocksForViewport(viewTimeStart, viewTimeEnd, scale)
    );

    const isLoading = this.getLoadingRegions().length > 0;
    if (isLoading) {
      fpsController.raise(FPS_ZOOM_ANIMATION);
    }
    const hasAnyData = allBlockSets.some(
      blocks => blocks.reduce((sum, block) => sum + block.pointCount, 0) >= MIN_POINTS_FOR_RENDERING
    );
    if (!hasAnyData && !isLoading) {
      return undefined;
    }

    for (const block of allBlockSets.flat()) {
      allocator.touch(block.slot);
    }

    const valueRange = visibleValueRangeAcrossSeries(allBlockSets, viewTimeStart, viewTimeEnd);
    if (!isNil(valueRange)) {
      const [viewValueMin, viewValueMax] = autoScaleY(valueRange[0], valueRange[1]);
      viewport.update({ viewValueMin, viewValueMax });
    }

    const currentCapacity = allocator.getCapacity();
    if (currentCapacity !== this.lastTextureCapacity) {
      this.lastTextureCapacity = currentCapacity;
      seriesManager.updateBindGroups(allocator.createView());
    }

    const { viewValueMin, viewValueMax } = viewport.current;
    seriesManager.writeAllUniforms(allBlockSets, {
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      viewTimeStart,
      viewTimeEnd,
      viewValueMin,
      viewValueMax,
    });

    const geometry = computePlotGeometry(
      canvasSize.width,
      canvasSize.height,
      canvasSize.devicePixelRatio
    );
    return {
      x: Math.floor(geometry.left),
      y: Math.floor(geometry.top),
      width: Math.max(0, Math.floor(geometry.width)),
      height: Math.max(0, Math.floor(geometry.height)),
    };
  }

  recordDrawCalls(
    pass: GPURenderPassEncoder,
    plotArea: IPlotArea,
    debugPipeline: GPURenderPipeline | undefined
  ): void {
    this.deps.seriesManager.renderAll(pass, plotArea);
    if (!isNil(debugPipeline)) {
      this.deps.seriesManager.renderDebug(pass, debugPipeline, plotArea);
    }
  }

  presentFrame(image: ImageBitmap): void {
    const { canvasSize, target2dContext, textMeasurer, viewport } = this.deps;
    // The backing store is sized right before painting so no blank frame shows.
    canvasSize.syncBackingStore();
    const layout = this.getFrameLayout();
    if (!isNil(layout)) {
      drawChartGrid(target2dContext, layout);
    }
    target2dContext.drawImage(image, 0, 0);
    if (!isNil(layout)) {
      drawChartAxes(target2dContext, layout, textMeasurer);
    }
    drawLoadingBars({
      ctx: target2dContext,
      regions: this.getLoadingRegions(),
      timeStart: viewport.current.viewTimeStart,
      timeEnd: viewport.current.viewTimeEnd,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      devicePixelRatio: canvasSize.devicePixelRatio,
      nowMs: performance.now(),
    });
  }

  dispose(): void {
    this.deps.dispose();
    this.deps.inputController.detach();
    this.deps.seriesManager.dispose();
    this.deps.allocator.dispose();
    this.deps.fpsController.dispose();
  }

  /** Reacts to a canvas resize: keeps the visible time range proportional to the width. */
  springTimeAxis(newWidth: number, previousWidth: number): void {
    const { viewTimeStart, viewTimeEnd } = this.deps.viewport.current;
    const springTimeRange = (viewTimeEnd - viewTimeStart) * (newWidth / previousWidth);
    const timeCenter = (viewTimeStart + viewTimeEnd) / 2;
    this.deps.viewport.update({
      viewTimeStart: timeCenter - springTimeRange / 2,
      viewTimeEnd: timeCenter + springTimeRange / 2,
    });
    this.deps.fpsController.raise(FPS_RESIZE);
  }

  private getLoadingRegions(): readonly ILoadingRegion[] {
    return this.deps.dataPipelines.flatMap(pipeline => pipeline.getLoadingRegions());
  }

  private getFrameLayout(): IChartFrameLayout | undefined {
    const { layoutCache, viewport, canvasSize } = this.deps;
    return layoutCache.getLayout(
      viewport.current,
      canvasSize.width,
      canvasSize.height,
      canvasSize.devicePixelRatio
    );
  }
}
