import { describe, expect, it } from 'vitest';

import { MAGNITUDE_EMA_ALPHA } from './constants';
import { updateMagnitudeRange } from './magnitude-range';

describe('updateMagnitudeRange', () => {
  it('seeds the range from the first live flush without smoothing', () => {
    expect(updateMagnitudeRange(undefined, 10, 500)).toEqual({ min: 10, max: 500 });
  });

  it('moves an established range toward the latest bounds by the EMA weight', () => {
    const next = updateMagnitudeRange({ min: 10, max: 100 }, 20, 200);

    expect(next?.min).toBeCloseTo(10 + (20 - 10) * MAGNITUDE_EMA_ALPHA);
    expect(next?.max).toBeCloseTo(100 + (200 - 100) * MAGNITUDE_EMA_ALPHA);
  });

  it('leaves the range untouched on an empty flush so colours do not drift toward zero', () => {
    const range = { min: 10, max: 100 };

    expect(updateMagnitudeRange(range, 0, 0)).toBe(range);
    expect(updateMagnitudeRange(undefined, 0, 0)).toBeUndefined();
  });
});
