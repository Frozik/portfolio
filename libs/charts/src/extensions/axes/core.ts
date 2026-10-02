import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IChartExtension } from '../../core/kernel/extension';

/** The width kept for every value scale beyond the first on its side, CSS pixels: the first is written inside the plot. */
export const SCALE_GUTTER = 56;

/**
 * The axis lines and the tick labels. Everything it draws comes from the
 * ticks; its own part is the room it takes: a gutter beside the plot for
 * every value scale that stands beyond the first on its side.
 */
export function axesCore<TX>(): IChartExtension<TX, 'axes', undefined> {
  return {
    id: 'axes',
    requires: [TICKS_EXTENSION],
    create: kernel => ({
      slice: undefined,
      insets: () => ({
        left: kernel.scales.outerScales('left') * SCALE_GUTTER,
        right: kernel.scales.outerScales('right') * SCALE_GUTTER,
        top: 0,
        bottom: 0,
      }),
    }),
  };
}
