import type { IChartFrameLayout } from './frame-layout';

/**
 * The visible range is spread over the whole canvas, margins included,
 * because that is where the series shaders and the pan and zoom gestures put
 * it; the plot rectangle only clips what is drawn.
 */
export function timeToPixelX(layout: IChartFrameLayout, time: number): number {
  const normalized = (time - layout.timeStart) / (layout.timeEnd - layout.timeStart);
  return normalized * layout.canvasWidth;
}

export function valueToPixelY(layout: IChartFrameLayout, value: number): number {
  const normalized = (value - layout.valueMin) / (layout.valueMax - layout.valueMin);
  return layout.canvasHeight - normalized * layout.canvasHeight;
}

export function pixelXToTime(layout: IChartFrameLayout, pixelX: number): number {
  const normalized = pixelX / layout.canvasWidth;
  return layout.timeStart + normalized * (layout.timeEnd - layout.timeStart);
}

export function pixelYToValue(layout: IChartFrameLayout, pixelY: number): number {
  const normalized = 1 - pixelY / layout.canvasHeight;
  return layout.valueMin + normalized * (layout.valueMax - layout.valueMin);
}
