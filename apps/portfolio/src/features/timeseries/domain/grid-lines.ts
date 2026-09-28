import type { IChartFrameLayout } from './frame-layout';
import { timeToPixelX, valueToPixelY } from './plot-mapping';

const GRID_LINE_WIDTH_RATIO = 0.5;
const GRID_DASH_LENGTH = 10;

/** A grid line as a rectangle in device pixels, measured from the top-left canvas corner. */
interface IGridLine {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface IChartGrid {
  readonly lines: readonly IGridLine[];
  /** Length of a dash and of the gap after it, in device pixels. */
  readonly dashLength: number;
  readonly opacity: number;
}

/**
 * One dashed line per visible tick. A line is a whole number of device pixels
 * thick and starts on a pixel boundary, so it stays sharp; the weight it
 * would lose by being thinner than a pixel is carried by its opacity.
 */
export function computeChartGrid(layout: IChartFrameLayout): IChartGrid {
  const { dpr, plotLeft, plotTop, plotRight, plotBottom, plotWidth, plotHeight } = layout;
  const nominalThickness = dpr * GRID_LINE_WIDTH_RATIO;
  const thickness = Math.max(1, Math.round(nominalThickness));
  const lines: IGridLine[] = [];

  for (const tick of layout.xTicks) {
    const pixelX = timeToPixelX(layout, tick.position);
    if (pixelX < plotLeft || pixelX > plotRight) {
      continue;
    }
    lines.push({
      left: Math.round(pixelX - thickness / 2),
      top: plotTop,
      width: thickness,
      height: plotHeight,
    });
  }

  for (const tick of layout.yTicks) {
    const pixelY = valueToPixelY(layout, tick.position);
    if (pixelY < plotTop || pixelY > plotBottom) {
      continue;
    }
    lines.push({
      left: plotLeft,
      top: Math.round(pixelY - thickness / 2),
      width: plotWidth,
      height: thickness,
    });
  }

  return {
    lines,
    dashLength: GRID_DASH_LENGTH * dpr,
    opacity: Math.min(1, nominalThickness / thickness),
  };
}
