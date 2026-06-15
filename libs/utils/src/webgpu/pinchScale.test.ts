import { describe, expect, it } from 'vitest';

import { computePinchScale, PINCH_MIN_DISTANCE_PX, pointerDistance } from './pinchScale';

describe('pointerDistance', () => {
  it('computes the euclidean distance between two pointers', () => {
    expect(pointerDistance(0, 0, 3, 4)).toBe(5);
  });

  it('is zero when both pointers coincide', () => {
    expect(pointerDistance(10, 20, 10, 20)).toBe(0);
  });
});

describe('computePinchScale', () => {
  it('returns the ratio of previous to current distance', () => {
    expect(computePinchScale(200, 100)).toBe(2);
    expect(computePinchScale(100, 200)).toBe(0.5);
  });

  it('returns null when current distance is zero (divide-by-zero guard)', () => {
    expect(computePinchScale(100, 0)).toBeNull();
  });

  it('returns null when current distance is below the minimum threshold', () => {
    expect(computePinchScale(100, PINCH_MIN_DISTANCE_PX - 0.5)).toBeNull();
  });

  it('computes a scale at exactly the minimum threshold', () => {
    expect(computePinchScale(100, PINCH_MIN_DISTANCE_PX)).toBe(100 / PINCH_MIN_DISTANCE_PX);
  });
});
