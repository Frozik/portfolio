import { MID_PRICE_FLAT_RATIO_EPSILON } from './constants';
import type { MidPriceDirection } from './mid-price-types';

/**
 * Signed relative price change between two adjacent samples:
 * `(priceTo - priceFrom) / priceTo`. Dimensionless (not per-second)
 * so the width formula doesn't depend on sample cadence. Returns `0`
 * when `priceTo` is non-finite or zero — pathological data; the
 * accumulator is responsible for not producing those, but we stay
 * defensive here so the shader never sees `NaN` / `Infinity`.
 */
export function computePriceChangeRatio(priceFrom: number, priceTo: number): number {
  if (!Number.isFinite(priceTo) || priceTo === 0) {
    return 0;
  }
  return (priceTo - priceFrom) / priceTo;
}

/**
 * Classify a signed price-change ratio into one of the three
 * direction buckets the renderer paints. Ratios with absolute
 * magnitude below `MID_PRICE_FLAT_RATIO_EPSILON` are reported as
 * `flat` so tiny FP noise near zero doesn't flicker the segment
 * colour between green and red.
 */
export function classifyDirection(priceChangeRatio: number): MidPriceDirection {
  if (Math.abs(priceChangeRatio) < MID_PRICE_FLAT_RATIO_EPSILON) {
    return 'flat';
  }
  return priceChangeRatio > 0 ? 'up' : 'down';
}
