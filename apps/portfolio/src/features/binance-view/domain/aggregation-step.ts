import { fractionDigitsFor } from './axis-scale';

/**
 * Price band each side of the heatmap should cover, as a fraction of the
 * price: with BTC at ~100 000 and a 1.5 step, 64 bins span ~0.1%.
 */
const RELATIVE_BAND_PER_SIDE = 0.001;

export interface IAggregationStepInput {
  /** Exchange price increment (`PRICE_FILTER.tickSize`). */
  readonly tickSize: number;
  readonly referencePrice: number;
  /** Price bins per side of the heatmap (`aggregatedDepth`). */
  readonly binsPerSide: number;
}

/**
 * Heatmap price-bin height for an instrument without a hand-tuned step:
 * the smallest whole number of ticks that lets `binsPerSide` bins cover
 * the reference band, never below one tick.
 */
export function deriveAggregationQuoteStep(input: IAggregationStepInput): number {
  const { tickSize, referencePrice, binsPerSide } = input;
  const targetStep = (referencePrice * RELATIVE_BAND_PER_SIDE) / binsPerSide;
  const ticks = Math.max(1, Math.ceil(targetStep / tickSize));
  return Number((ticks * tickSize).toFixed(fractionDigitsFor(tickSize)));
}
