import type { IChartFrame } from '../../core/frame/chart-frame';
import type { IPixelRect } from '../../core/frame/pixel-rect';
import { requiredTicks } from '../../core/frame/required-ticks';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IChartExtension } from '../../core/kernel/extension';
import { valueToPixel, xToPixel } from '../../core/viewport/plot-mapping';

const LINE_WIDTH_RATIO = 0.5;
const DASH_LENGTH = 10;

export interface IChartGrid {
  readonly lines: readonly IPixelRect[];
  /** Length of a dash and of the gap after it, in device pixels. */
  readonly dashLength: number;
  readonly opacity: number;
}

export interface IGridSlice<TX> {
  gridOf(frame: IChartFrame<TX>): IChartGrid;
}

/**
 * One dashed line per visible tick. A line is a whole number of device pixels
 * thick and starts on a pixel boundary, so it stays sharp; the weight it
 * would lose by being thinner than a pixel is carried by its opacity.
 */
export function gridCore<TX>(): IChartExtension<TX, 'grid', IGridSlice<TX>> {
  return {
    id: 'grid',
    requires: [TICKS_EXTENSION],
    create(kernel) {
      const ticks = requiredTicks(kernel);

      const gridOf = (frame: IChartFrame<TX>): IChartGrid => {
        const { plot, size } = frame;
        const nominalThickness = size.devicePixelRatio * LINE_WIDTH_RATIO;
        const thickness = Math.max(1, Math.round(nominalThickness));
        const lines: IPixelRect[] = [];

        for (const tick of ticks.xTicks(frame)) {
          const pixel = xToPixel(frame, tick.position);
          if (pixel >= plot.left && pixel <= plot.right) {
            lines.push({
              left: Math.round(pixel - thickness / 2),
              top: plot.top,
              width: thickness,
              height: plot.height,
            });
          }
        }
        for (const tick of ticks.yTicks(frame)) {
          const pixel = valueToPixel(frame, tick.position);
          if (pixel >= plot.top && pixel <= plot.bottom) {
            lines.push({
              left: plot.left,
              top: Math.round(pixel - thickness / 2),
              width: plot.width,
              height: thickness,
            });
          }
        }
        return {
          lines,
          dashLength: DASH_LENGTH * size.devicePixelRatio,
          opacity: Math.min(1, nominalThickness / thickness),
        };
      };

      return { slice: { gridOf } };
    },
  };
}
