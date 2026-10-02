import { isNil } from 'lodash-es';

import type { IMark } from '../../core/series/mark';

export interface IColumnMarkOptions {
  /** Where the columns stand: a value — nought for a histogram — or the bottom edge of the plot. */
  readonly baseline: number | 'bottom';
  /** The least room kept between neighbouring columns, CSS pixels. */
  readonly gap: number;
}

const DEFAULT_OPTIONS: IColumnMarkOptions = { baseline: 'bottom', gap: 0 };

function isColumnOptions(options: unknown): options is Partial<IColumnMarkOptions> {
  return typeof options === 'object' && !isNil(options);
}

/** The options a use of the mark carries, with what it left out filled in. */
export function columnOptionsOf(options: unknown): IColumnMarkOptions {
  return isColumnOptions(options) ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS;
}

/**
 * A column per element from a baseline to its value — volume bars from the
 * bottom of the plot, a histogram from nought. A candle counts by its close.
 */
export const COLUMN_MARK: IMark = {
  id: 'column',
  shapes: ['point', 'candle'],
  valueRange(run, from, to, options) {
    const closes = run.shape === 'candle' ? run.close : run.value;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let index = from; index < to; index += 1) {
      const value = closes[index];
      if (!Number.isNaN(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    if (!(min <= max)) {
      return undefined;
    }
    const { baseline } = columnOptionsOf(options);
    return baseline === 'bottom'
      ? { min, max }
      : { min: Math.min(min, baseline), max: Math.max(max, baseline) };
  },
  painters: {},
};
