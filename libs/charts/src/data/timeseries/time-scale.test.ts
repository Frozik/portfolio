import { describe, expect, it } from 'vitest';

import { TIME_SCALES } from './time-scale';

describe('grid of time scales', () => {
  it('runs from the finest step to the coarsest', () => {
    const sorted = [...TIME_SCALES].sort((first, second) => (first < second ? -1 : 1));

    expect(TIME_SCALES).toEqual(sorted);
  });

  it('has every step divide the next, so coarser intervals are whole numbers of finer ones', () => {
    TIME_SCALES.slice(1).forEach((scale, index) => {
      expect(scale % TIME_SCALES[index]).toBe(0n);
    });
  });

  it('never thins the elements more than five times at one step', () => {
    TIME_SCALES.slice(1).forEach((scale, index) => {
      const ratio = Number(scale / TIME_SCALES[index]);
      expect(ratio).toBeGreaterThanOrEqual(2);
      expect(ratio).toBeLessThanOrEqual(5);
    });
  });
});
