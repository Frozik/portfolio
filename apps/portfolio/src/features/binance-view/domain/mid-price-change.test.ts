import { MID_PRICE_FLAT_RATIO_EPSILON } from './constants';
import { classifyDirection, computePriceChangeRatio } from './mid-price-change';

describe('computePriceChangeRatio', () => {
  it('returns positive ratio when price rises', () => {
    expect(computePriceChangeRatio(100, 110)).toBeCloseTo(10 / 110, 10);
  });

  it('returns negative ratio when price falls', () => {
    expect(computePriceChangeRatio(110, 100)).toBeCloseTo(-10 / 100, 10);
  });

  it('returns zero when the destination price is zero (pathological)', () => {
    expect(computePriceChangeRatio(100, 0)).toBe(0);
  });

  it('returns zero when the destination price is non-finite', () => {
    expect(computePriceChangeRatio(100, Number.POSITIVE_INFINITY)).toBe(0);
    expect(computePriceChangeRatio(100, Number.NaN)).toBe(0);
  });

  it('returns zero when both samples share the same price', () => {
    expect(computePriceChangeRatio(100, 100)).toBe(0);
  });
});

describe('classifyDirection', () => {
  it('reports "up" for a ratio clearly above the flat epsilon', () => {
    expect(classifyDirection(MID_PRICE_FLAT_RATIO_EPSILON * 10)).toBe('up');
  });

  it('reports "down" for a ratio clearly below the negative epsilon', () => {
    expect(classifyDirection(-MID_PRICE_FLAT_RATIO_EPSILON * 10)).toBe('down');
  });

  it('reports "flat" for a zero ratio', () => {
    expect(classifyDirection(0)).toBe('flat');
  });

  it('reports "flat" for a positive ratio below the epsilon', () => {
    expect(classifyDirection(MID_PRICE_FLAT_RATIO_EPSILON / 2)).toBe('flat');
  });

  it('reports "flat" for a negative ratio just inside the epsilon', () => {
    expect(classifyDirection(-MID_PRICE_FLAT_RATIO_EPSILON / 2)).toBe('flat');
  });
});
