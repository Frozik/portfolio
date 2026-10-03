import { isNil } from 'lodash-es';

import type { IChartExtension } from '../../core/kernel/extension';
import type { IAxisRange } from '../../core/viewport/axis-domain';
import { spanOf } from '../../core/viewport/axis-domain';

export interface IBoundsOptions<TX> {
  /** The leftmost position that may be shown; `'data'` is the start of the data, once known. */
  readonly min?: TX | 'data';
  /** The rightmost position that may be shown; `'data'` is the end of the data, once known. */
  readonly max?: TX | 'data';
  /** The shortest range that may be shown, in axis units. */
  readonly minRange?: number;
}

/** Keeps the visible range inside limits and no shorter than a least span (§7.1). */
export function bounds<TX>(options: IBoundsOptions<TX>): IChartExtension<TX, 'bounds', undefined> {
  return {
    id: 'bounds',
    create(kernel) {
      const { domain } = kernel;
      // Limits are given in world coordinates; the extent of the data already comes as the viewport counts it.
      const limit = (side: TX | 'data' | undefined, known: TX | undefined): TX | undefined => {
        if (side === 'data') {
          return known;
        }
        return isNil(side) ? undefined : (kernel.viewport.x.mapping?.toVirtual(side) ?? side);
      };

      const constrainX = (range: IAxisRange<TX>): IAxisRange<TX> => {
        let { start, end } = range;
        const shortfall = (options.minRange ?? 0) - spanOf(domain, range);
        if (shortfall > 0) {
          start = domain.add(start, -shortfall / 2);
          end = domain.add(end, shortfall / 2);
        }
        const span = domain.diff(end, start);
        const min = limit(options.min, kernel.dataExtent.start);
        const max = limit(options.max, kernel.dataExtent.end);
        if (!isNil(min) && !isNil(max) && span >= domain.diff(max, min)) {
          return { start: min, end: max };
        }
        if (!isNil(min) && domain.compare(start, min) < 0) {
          return { start: min, end: domain.add(min, span) };
        }
        if (!isNil(max) && domain.compare(end, max) > 0) {
          return { start: domain.add(max, -span), end: max };
        }
        return { start, end };
      };

      return { slice: undefined, constrainX };
    },
  };
}
