import { isNil } from 'lodash-es';

import type { IChartExtension, IVisibleData } from '../../core/kernel/extension';
import { fromAxis, toAxis } from '../../core/scale/scale-mapping';
import { lowerBound, upperBound } from '../../core/series/search';
import type { IAxisRange } from '../../core/viewport/axis-domain';

const DEFAULT_PADDING = 0.1;
/** A logarithmic scale cannot reach nought: values at or below it are shown this far under the maximum. */
const LOG_FLOOR_RATIO = 1e-3;

export interface IAutoScaleYOptions {
  /** Room left above and below the data, as a share of its height; a scale may ask for its own. */
  readonly padding?: number;
}

/** Fits every value scale to what is visible against it, with a little room; candles by their extremes (§7.1). */
export function autoScaleY<TX>(
  options: IAutoScaleYOptions = {}
): IChartExtension<TX, 'autoScaleY', undefined> {
  const defaultPadding = options.padding ?? DEFAULT_PADDING;

  const fitY = (visible: IVisibleData<TX>): IAxisRange<number> | undefined => {
    const { domain, x, scaleKind, series } = visible;
    const padding = visible.padding ?? defaultPadding;
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
    // The room is measured as the axis measures: on a logarithmic scale it is a ratio, not a difference.
    const low = toAxis(scaleKind, scaleKind === 'log' && min <= 0 ? max * LOG_FLOOR_RATIO : min);
    const high = toAxis(scaleKind, max);
    const room = (high - low) * padding;
    return { start: fromAxis(scaleKind, low - room), end: fromAxis(scaleKind, high + room) };
  };

  return { id: 'autoScaleY', create: () => ({ slice: undefined, fitY }) };
}
