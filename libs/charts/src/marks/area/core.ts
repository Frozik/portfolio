import { isNil } from 'lodash-es';

import type { IMark } from '../../core/series/mark';
import { valueRangeOfElements } from '../../core/series/mark';
import type { TLineJoin } from '../line/core';

export interface IAreaMarkOptions {
  /** Where the band ends: a value, or the bottom edge of the plot. */
  readonly baseline: number | 'bottom';
  readonly join: TLineJoin;
}

const DEFAULT_OPTIONS: IAreaMarkOptions = { baseline: 'bottom', join: 'linear' };

function isAreaOptions(options: unknown): options is Partial<IAreaMarkOptions> {
  return typeof options === 'object' && !isNil(options);
}

/** The options a use of the mark carries, with what it left out filled in. */
export function areaOptionsOf(options: unknown): IAreaMarkOptions {
  return isAreaOptions(options) ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS;
}

/** A band from the line to its baseline (§5.3). */
export const AREA_MARK: IMark = {
  id: 'area',
  shapes: ['point', 'candle'],
  valueRange(run, from, to, options) {
    const range = valueRangeOfElements(run, from, to);
    const { baseline } = areaOptionsOf(options);
    if (isNil(range) || baseline === 'bottom') {
      return range;
    }
    return { min: Math.min(range.min, baseline), max: Math.max(range.max, baseline) };
  },
  painters: {},
};
