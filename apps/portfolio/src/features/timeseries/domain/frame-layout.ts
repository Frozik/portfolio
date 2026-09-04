import { computePlotGeometry } from './plot-geometry';
import { TickCache } from './tick-cache';
import type { IAxisTick, IChartViewport } from './types';
import { scaleFromTimeRange } from './viewport';

/** Per-frame geometry and tick data shared by the grid and axis painters. */
export interface IChartFrameLayout {
  readonly timeStart: number;
  readonly timeEnd: number;
  readonly valueMin: number;
  readonly valueMax: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly dpr: number;
  readonly plotLeft: number;
  readonly plotTop: number;
  readonly plotWidth: number;
  readonly plotHeight: number;
  readonly plotRight: number;
  readonly plotBottom: number;
  readonly xTicks: readonly IAxisTick[];
  readonly yTicks: readonly IAxisTick[];
}

/**
 * Memoises the frame layout, recomputing only when the viewport or canvas
 * size changes — saves ~2-4ms/frame by avoiding redundant computeXTicks /
 * computeYTicks calls (Temporal objects, string formatting, tick thinning)
 * across the grid and axis painters, which both run every frame.
 */
export class FrameLayoutCache {
  private readonly tickCache = new TickCache();
  private layout: IChartFrameLayout | undefined;

  getLayout(
    viewport: IChartViewport,
    canvasWidth: number,
    canvasHeight: number,
    devicePixelRatio: number
  ): IChartFrameLayout | undefined {
    const { viewTimeStart, viewTimeEnd, viewValueMin, viewValueMax } = viewport;
    const cached = this.layout;

    if (
      cached !== undefined &&
      cached.timeStart === viewTimeStart &&
      cached.timeEnd === viewTimeEnd &&
      cached.valueMin === viewValueMin &&
      cached.valueMax === viewValueMax &&
      cached.canvasWidth === canvasWidth &&
      cached.canvasHeight === canvasHeight
    ) {
      return cached;
    }

    const {
      left: plotLeft,
      top: plotTop,
      width: plotWidth,
      height: plotHeight,
    } = computePlotGeometry(canvasWidth, canvasHeight, devicePixelRatio);

    if (plotWidth <= 0 || plotHeight <= 0) {
      this.layout = undefined;
      return undefined;
    }

    const scale = scaleFromTimeRange(viewTimeStart, viewTimeEnd);
    const clientPlotWidth = plotWidth / devicePixelRatio;
    const clientPlotHeight = plotHeight / devicePixelRatio;

    this.layout = {
      timeStart: viewTimeStart,
      timeEnd: viewTimeEnd,
      valueMin: viewValueMin,
      valueMax: viewValueMax,
      canvasWidth,
      canvasHeight,
      dpr: devicePixelRatio,
      plotLeft,
      plotTop,
      plotWidth,
      plotHeight,
      plotRight: plotLeft + plotWidth,
      plotBottom: plotTop + plotHeight,
      xTicks: this.tickCache.getXTicks(viewTimeStart, viewTimeEnd, scale, clientPlotWidth),
      yTicks: this.tickCache.getYTicks(viewValueMin, viewValueMax, clientPlotHeight),
    };

    return this.layout;
  }
}
