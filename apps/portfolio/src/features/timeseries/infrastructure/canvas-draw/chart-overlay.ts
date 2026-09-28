import { isNil } from 'lodash-es';

import type { ICrosshair } from '../../domain/crosshair';
import type { IChartFrameLayout } from '../../domain/frame-layout';
import type { ITextMeasurer } from '../../domain/text-measurer';
import type { ILoadingRegion } from '../../domain/types';
import { drawChartAxes } from './axes';
import { createAxisLabelStyle } from './axis-label';
import { drawCrosshair } from './crosshair';
import { drawLoadingBars } from './loading-bars';

export interface IChartOverlayFrame {
  readonly layout: IChartFrameLayout | undefined;
  readonly crosshair: ICrosshair | undefined;
  readonly loadingRegions: readonly ILoadingRegion[];
  readonly timeStart: number;
  readonly timeEnd: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly devicePixelRatio: number;
  /** Resizing the backing store cleared the canvas. */
  readonly canvasCleared: boolean;
}

function isSamePlace(first: ICrosshair | undefined, second: ICrosshair | undefined): boolean {
  return first?.lineLeft === second?.lineLeft && first?.lineTop === second?.lineTop;
}

/**
 * The transparent 2D canvas stacked above the GPU canvas: axes, labels,
 * loading bars and the crosshair. It keeps what it painted, so it repaints
 * only when the layout changes, the crosshair moves, the canvas was cleared
 * or the loading bars are animating.
 */
export class ChartOverlay {
  private paintedLayout: IChartFrameLayout | undefined;
  private paintedCrosshair: ICrosshair | undefined;
  private paintedLoadingBars = false;

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly textMeasurer: ITextMeasurer
  ) {}

  paint(frame: IChartOverlayFrame): void {
    const hasLoadingBars = frame.loadingRegions.length > 0;
    if (
      !frame.canvasCleared &&
      frame.layout === this.paintedLayout &&
      isSamePlace(frame.crosshair, this.paintedCrosshair) &&
      !hasLoadingBars &&
      !this.paintedLoadingBars
    ) {
      return;
    }
    this.paintedLayout = frame.layout;
    this.paintedCrosshair = frame.crosshair;
    this.paintedLoadingBars = hasLoadingBars;

    this.context.clearRect(0, 0, frame.canvasWidth, frame.canvasHeight);
    this.paintAxes(frame);
    drawLoadingBars({
      ctx: this.context,
      regions: frame.loadingRegions,
      timeStart: frame.timeStart,
      timeEnd: frame.timeEnd,
      canvasWidth: frame.canvasWidth,
      canvasHeight: frame.canvasHeight,
      devicePixelRatio: frame.devicePixelRatio,
      nowMs: performance.now(),
    });
  }

  private paintAxes({ layout, crosshair }: IChartOverlayFrame): void {
    if (isNil(layout)) {
      return;
    }
    const style = createAxisLabelStyle(layout, this.textMeasurer);
    drawChartAxes(this.context, layout, style, this.textMeasurer);
    if (!isNil(crosshair)) {
      drawCrosshair(this.context, layout, crosshair, style, this.textMeasurer);
    }
  }
}
