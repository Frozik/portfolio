import type { IPlotRect } from '../frame/plot-rect';
import type { IInsets } from '../frame/theme';
import type { IChartSize } from '../host/size-source';

/**
 * The plot rectangle: the canvas less the insets. One source for the GPU
 * scissor and for the 2D painters, so the two cannot drift apart.
 */
export function plotRectOf(size: IChartSize, insets: IInsets): IPlotRect {
  const { width, height, devicePixelRatio } = size;
  const left = Math.floor(insets.left * devicePixelRatio);
  const top = Math.floor(insets.top * devicePixelRatio);
  const plotWidth = Math.max(
    0,
    Math.floor(width - (insets.left + insets.right) * devicePixelRatio)
  );
  const plotHeight = Math.max(
    0,
    Math.floor(height - (insets.top + insets.bottom) * devicePixelRatio)
  );
  return {
    left,
    top,
    width: plotWidth,
    height: plotHeight,
    right: left + plotWidth,
    bottom: top + plotHeight,
  };
}
