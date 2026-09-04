import { describe, expect, it } from 'vitest';

import { deriveAggregationQuoteStep } from './aggregation-step';

const BINS_PER_SIDE = 64;

describe('deriveAggregationQuoteStep', () => {
  it('covers roughly a tenth of a percent per side for a high-priced instrument', () => {
    expect(
      deriveAggregationQuoteStep({
        tickSize: 0.01,
        referencePrice: 100_000,
        binsPerSide: BINS_PER_SIDE,
      })
    ).toBe(1.57);
  });

  it('never goes below one exchange tick for a low-priced instrument', () => {
    expect(
      deriveAggregationQuoteStep({
        tickSize: 0.00001,
        referencePrice: 0.2,
        binsPerSide: BINS_PER_SIDE,
      })
    ).toBe(0.00001);
  });

  it('rounds to the tick size precision instead of leaking float noise', () => {
    expect(
      deriveAggregationQuoteStep({
        tickSize: 0.01,
        referencePrice: 4300,
        binsPerSide: BINS_PER_SIDE,
      })
    ).toBe(0.07);
  });
});
