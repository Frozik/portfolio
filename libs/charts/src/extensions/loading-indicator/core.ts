import { ACTIVE_FPS } from '../../core/frame/frame-demand';
import type { IChartExtension } from '../../core/kernel/extension';

/** The wash over a failed range moves slowly: half the rate is smooth enough and costs half as much. */
const FAILED_FPS = 30;

/** Shows what is still on its way and what failed to arrive; keeps frames coming while either is animated (§7.1). */
export function loadingIndicatorCore<TX>(): IChartExtension<TX, 'loadingIndicator', undefined> {
  return {
    id: 'loadingIndicator',
    create: kernel => ({
      slice: undefined,
      tick(): void {
        if (kernel.series.loading.length > 0) {
          kernel.frames.raise(ACTIVE_FPS);
        } else if (kernel.series.failed.length > 0) {
          kernel.frames.raise(FAILED_FPS);
        }
      },
    }),
  };
}
