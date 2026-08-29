import type { IChartFrameLayout } from '../frame-layout';

/** Project a tick time onto its device-pixel X coordinate inside the plot rect. */
export function timeToPixelX(layout: IChartFrameLayout, time: number): number {
  const normalized = (time - layout.timeStart) / (layout.timeEnd - layout.timeStart);
  return layout.plotLeft + normalized * layout.plotWidth;
}

/** Project a tick value onto its device-pixel Y coordinate inside the plot rect. */
export function valueToPixelY(layout: IChartFrameLayout, value: number): number {
  const normalized = (value - layout.valueMin) / (layout.valueMax - layout.valueMin);
  return layout.plotBottom - normalized * layout.plotHeight;
}
