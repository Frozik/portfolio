import { describe, expect, it } from 'vitest';

import { refreshIntervalOf, refreshRateOf } from './refresh-rate';

describe('the display rate', () => {
  it('is read through a clock rounded to a millisecond', () => {
    const rounded = Array.from({ length: 60 }, (_, index) => (index % 3 === 0 ? 16 : 17));

    expect(refreshRateOf(refreshIntervalOf(rounded) ?? 0)).toBe(60);
  });

  it('ignores dropped frames among the steady ones', () => {
    const intervals = [8.3, 8.4, 8.3, 16.7, 8.3, 8.4, 250, 8.3, 8.3];

    expect(refreshRateOf(refreshIntervalOf(intervals) ?? 0)).toBe(120);
  });

  it('is unknown with no frames to read it from', () => {
    expect(refreshIntervalOf([])).toBeUndefined();
  });

  it('is shown as measured when it is no rate displays are made with', () => {
    expect(refreshRateOf(1000 / 110)).toBe(110);
    expect(refreshRateOf(1000 / 59.94)).toBe(60);
  });
});
