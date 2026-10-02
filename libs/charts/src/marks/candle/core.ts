import { isNil } from 'lodash-es';

import type { IMark } from '../../core/series/mark';
import { valueRangeOfElements } from '../../core/series/mark';

export interface ICandleMarkOptions {
  /** The least room kept between neighbouring candles, CSS pixels. */
  readonly gap: number;
}

const DEFAULT_OPTIONS: ICandleMarkOptions = { gap: 0 };

function isCandleOptions(options: unknown): options is Partial<ICandleMarkOptions> {
  return typeof options === 'object' && !isNil(options);
}

/** The options a use of the mark carries, with what it left out filled in. */
export function candleOptionsOf(options: unknown): ICandleMarkOptions {
  return isCandleOptions(options) ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS;
}

/** A body from open to close and a wick from the low to the high; drawn from candles only (§5.4). */
export const CANDLE_MARK: IMark = {
  id: 'candle',
  shapes: ['candle'],
  valueRange: valueRangeOfElements,
  painters: {},
};
