import { isNil } from 'lodash-es';

import type { IChartExtension, IVisibleData } from '../../core/kernel/extension';
import { lowerBound, upperBound } from '../../core/series/search';
import type { IValueRange } from '../../core/viewport/axis-domain';

const DEFAULT_PADDING = 0.1;

export interface IAutoScaleYOptions {
  /** Room left above and below the data, as a share of its height. */
  readonly padding?: number;
}

/** Fits the value axis to what is visible, with a little room; candles by their extremes (§7.1). */
export function autoScaleY<TX>(
  options: IAutoScaleYOptions = {}
): IChartExtension<TX, 'autoScaleY', undefined> {
  const padding = options.padding ?? DEFAULT_PADDING;

  const fitY = ({ domain, x, series }: IVisibleData<TX>): IValueRange | undefined => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const { runs } of series) {
      for (const { run, style } of runs) {
        const from = lowerBound(domain, run.x, run.length, x.start);
        const to = upperBound(domain, run.x, run.length, x.end);
        for (const { mark, options: markOptions } of style.marks) {
          const range = mark.valueRange(run, from, to, markOptions);
          if (!isNil(range)) {
            min = Math.min(min, range.min);
            max = Math.max(max, range.max);
          }
        }
      }
    }
    // A single value has no height to fit: the axis keeps what it had rather than collapsing.
    if (!(min < max)) {
      return undefined;
    }
    const room = (max - min) * padding;
    return { min: min - room, max: max + room };
  };

  return { id: 'autoScaleY', create: () => ({ slice: undefined, fitY }) };
}
