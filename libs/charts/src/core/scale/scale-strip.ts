import type { IChartFrame } from '../frame/chart-frame';
import type { IPixelRect } from '../frame/pixel-rect';
import type { IScaleFrame } from './scale';

/** The width kept for every value scale beyond the first on its side, CSS pixels: the first is written inside the plot. */
export const SCALE_GUTTER = 56;

/** Where the line of a value scale stands, device pixels: the first on a side on the edge of the plot, each further one a gutter beyond. */
export function scaleLineX(frame: IChartFrame<unknown>, scale: IScaleFrame): number {
  const gutter = SCALE_GUTTER * frame.size.devicePixelRatio;
  return scale.side === 'left'
    ? frame.plot.left - scale.order * gutter
    : frame.plot.right + scale.order * gutter;
}

/** The strip a scale is written in, a gutter wide, down the height of its pane: where the pointer works on the scale. */
export function scaleStripOf(frame: IChartFrame<unknown>, scale: IScaleFrame): IPixelRect {
  const width = SCALE_GUTTER * frame.size.devicePixelRatio;
  const lineX = scaleLineX(frame, scale);
  const { plot } = scale;
  // The labels stand on the plot side of the line: the strip reaches from the line towards the plot, inside it or in the gutter.
  const left = scale.side === 'left' ? lineX : lineX - width;
  return { left, top: plot.top, width, height: plot.height };
}

export function containsPixel(rect: IPixelRect, x: number, y: number): boolean {
  return (
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
  );
}
