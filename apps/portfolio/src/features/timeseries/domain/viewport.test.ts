import { MIN_TIME_RANGE_SECONDS, Y_PADDING_RATIO } from './constants';
import { ETimeScale } from './types';
import {
  autoScaleY,
  clampViewport,
  panViewport,
  scaleFromTimeRange,
  visibleYRange,
  zoomViewport,
} from './viewport';

describe('scaleFromTimeRange', () => {
  it('returns Hour1 for duration equal to Hour1', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Hour1)).toBe(ETimeScale.Hour1);
  });

  it('returns Hour1 for very small durations', () => {
    expect(scaleFromTimeRange(0, 1)).toBe(ETimeScale.Hour1);
  });

  it('returns Hour1 for zero duration', () => {
    expect(scaleFromTimeRange(100, 100)).toBe(ETimeScale.Hour1);
  });

  it('returns Hour12 when duration exceeds Hour1 but fits Hour12', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Hour1 + 1)).toBe(ETimeScale.Hour12);
  });

  it('returns Hour12 when duration equals Hour12', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Hour12)).toBe(ETimeScale.Hour12);
  });

  it('returns Day1 when duration exceeds Hour12 but fits Day1', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Hour12 + 1)).toBe(ETimeScale.Day1);
  });

  it('returns Day4 when duration exceeds Day1 but fits Day4', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Day1 + 1)).toBe(ETimeScale.Day4);
  });

  it('returns Day16 when duration exceeds Day4 but fits Day16', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Day4 + 1)).toBe(ETimeScale.Day16);
  });

  it('returns Day64 when duration exceeds Day16 but fits Day64', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Day16 + 1)).toBe(ETimeScale.Day64);
  });

  it('returns Day256 when duration exceeds Day64 but fits Day256', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Day64 + 1)).toBe(ETimeScale.Day256);
  });

  it('returns Day256 when duration exceeds Day256', () => {
    expect(scaleFromTimeRange(0, ETimeScale.Day256 + 1)).toBe(ETimeScale.Day256);
  });

  it('works with non-zero start time', () => {
    const start = 1000;
    expect(scaleFromTimeRange(start, start + ETimeScale.Hour1)).toBe(ETimeScale.Hour1);
    expect(scaleFromTimeRange(start, start + ETimeScale.Day256 + 1)).toBe(ETimeScale.Day256);
  });
});

describe('clampViewport', () => {
  const MIN = 100;
  const MAX = 1000;

  it('returns unchanged viewport when fully within bounds', () => {
    expect(clampViewport(200, 800, MIN, MAX)).toEqual([200, 800]);
  });

  it('shifts right when viewport overshoots left boundary', () => {
    expect(clampViewport(50, 550, MIN, MAX)).toEqual([MIN, MIN + 500]);
  });

  it('shifts left when viewport overshoots right boundary', () => {
    expect(clampViewport(600, 1100, MIN, MAX)).toEqual([MAX - 500, MAX]);
  });

  it('returns full bounds when range exceeds total bounds', () => {
    expect(clampViewport(0, 2000, MIN, MAX)).toEqual([MIN, MAX]);
  });

  it('returns full bounds when range exactly equals total bounds', () => {
    expect(clampViewport(100, 1000, MIN, MAX)).toEqual([MIN, MAX]);
  });

  it('handles viewport at exact left boundary', () => {
    expect(clampViewport(MIN, MIN + 200, MIN, MAX)).toEqual([MIN, MIN + 200]);
  });

  it('handles viewport at exact right boundary', () => {
    expect(clampViewport(MAX - 200, MAX, MIN, MAX)).toEqual([MAX - 200, MAX]);
  });

  it('handles zero-width range at minimum', () => {
    expect(clampViewport(MIN, MIN, MIN, MAX)).toEqual([MIN, MIN]);
  });
});

describe('autoScaleY', () => {
  it('applies padding to a normal range', () => {
    const [yMin, yMax] = autoScaleY(10, 20);
    const range = 10;
    const padding = range * Y_PADDING_RATIO;

    expect(yMin).toBe(10 - padding);
    expect(yMax).toBe(20 + padding);
  });

  it('uses value-based padding when range is zero', () => {
    const [yMin, yMax] = autoScaleY(5, 5);
    const padding = Math.abs(5) * Y_PADDING_RATIO;

    expect(yMin).toBe(5 - padding);
    expect(yMax).toBe(5 + padding);
  });

  it('handles negative values', () => {
    const [yMin, yMax] = autoScaleY(-20, -10);
    const range = 10;
    const padding = range * Y_PADDING_RATIO;

    expect(yMin).toBe(-20 - padding);
    expect(yMax).toBe(-10 + padding);
  });

  it('handles a small positive range', () => {
    const [yMin, yMax] = autoScaleY(0, 0.001);
    const padding = 0.001 * Y_PADDING_RATIO;

    expect(yMin).toBeCloseTo(-padding);
    expect(yMax).toBeCloseTo(0.001 + padding);
  });

  it('handles range crossing zero', () => {
    const [yMin, yMax] = autoScaleY(-5, 5);
    const padding = 10 * Y_PADDING_RATIO;

    expect(yMin).toBe(-5 - padding);
    expect(yMax).toBe(5 + padding);
  });
});

describe('visibleYRange', () => {
  it('returns undefined for empty arrays', () => {
    const times = new Float64Array([]);
    const values = new Float64Array([]);

    expect(visibleYRange(times, values, 0, 100)).toBeUndefined();
  });

  it('returns undefined when all points are outside the time range (before)', () => {
    const times = new Float64Array([1, 2, 3]);
    const values = new Float64Array([10, 20, 30]);

    expect(visibleYRange(times, values, 5, 10)).toBeUndefined();
  });

  it('returns undefined when all points are outside the time range (after)', () => {
    const times = new Float64Array([10, 20, 30]);
    const values = new Float64Array([1, 2, 3]);

    expect(visibleYRange(times, values, 0, 5)).toBeUndefined();
  });

  it('returns min/max for full coverage', () => {
    const times = new Float64Array([1, 2, 3, 4, 5]);
    const values = new Float64Array([10, 50, 20, 40, 30]);

    expect(visibleYRange(times, values, 0, 10)).toEqual([10, 50]);
  });

  it('returns min/max for partial overlap', () => {
    const times = new Float64Array([1, 2, 3, 4, 5]);
    const values = new Float64Array([10, 50, 20, 40, 30]);

    // Only points at t=2, t=3 are in range
    expect(visibleYRange(times, values, 2, 3)).toEqual([20, 50]);
  });

  it('handles a single point within range', () => {
    const times = new Float64Array([1, 5, 10]);
    const values = new Float64Array([100, 200, 300]);

    expect(visibleYRange(times, values, 4, 6)).toEqual([200, 200]);
  });

  it('includes points exactly at the boundaries', () => {
    const times = new Float64Array([1, 2, 3, 4, 5]);
    const values = new Float64Array([10, 20, 30, 40, 50]);

    // timeStart=2, timeEnd=4 should include points at t=2, t=3, t=4
    expect(visibleYRange(times, values, 2, 4)).toEqual([20, 40]);
  });

  it('handles negative values', () => {
    const times = new Float64Array([1, 2, 3]);
    const values = new Float64Array([-30, -10, -20]);

    expect(visibleYRange(times, values, 0, 10)).toEqual([-30, -10]);
  });

  it('binary search works with large sorted arrays', () => {
    const size = 10000;
    const times = new Float64Array(size);
    const values = new Float64Array(size);

    for (let i = 0; i < size; i++) {
      times[i] = i;
      values[i] = Math.sin(i);
    }

    // Query a narrow window in the middle
    const result = visibleYRange(times, values, 5000, 5010);

    expect(result).toBeDefined();

    if (result === undefined) {
      return;
    }

    const [min, max] = result;
    // Verify min/max by brute force
    let expectedMin = Number.POSITIVE_INFINITY;
    let expectedMax = Number.NEGATIVE_INFINITY;

    for (let i = 5000; i <= 5010; i++) {
      const v = Math.sin(i);
      if (v < expectedMin) {
        expectedMin = v;
      }
      if (v > expectedMax) {
        expectedMax = v;
      }
    }

    expect(min).toBeCloseTo(expectedMin);
    expect(max).toBeCloseTo(expectedMax);
  });

  it('returns undefined when timeStart equals timeEnd and no exact match', () => {
    const times = new Float64Array([1, 3, 5]);
    const values = new Float64Array([10, 20, 30]);

    expect(visibleYRange(times, values, 2, 2)).toBeUndefined();
  });

  it('returns value when timeStart equals timeEnd and there is an exact match', () => {
    const times = new Float64Array([1, 3, 5]);
    const values = new Float64Array([10, 20, 30]);

    expect(visibleYRange(times, values, 3, 3)).toEqual([20, 20]);
  });
});

describe('panViewport', () => {
  it('pans left (positive delta shifts time backward)', () => {
    const [start, end] = panViewport(100, 200, 50, 500);
    const timePerPixel = 100 / 500;
    const deltaTime = 50 * timePerPixel;

    expect(start).toBe(100 - deltaTime);
    expect(end).toBe(200 - deltaTime);
  });

  it('pans right (negative delta shifts time forward)', () => {
    const [start, end] = panViewport(100, 200, -50, 500);
    const timePerPixel = 100 / 500;
    const deltaTime = -50 * timePerPixel;

    expect(start).toBe(100 - deltaTime);
    expect(end).toBe(200 - deltaTime);
  });

  it('does not change viewport when delta is zero', () => {
    expect(panViewport(100, 200, 0, 500)).toEqual([100, 200]);
  });

  it('preserves the time range duration', () => {
    const [start, end] = panViewport(100, 300, 100, 1000);

    expect(end - start).toBe(200);
  });

  it('handles large delta relative to canvas width', () => {
    // Delta equals canvas width => shift by full time range
    const [start, end] = panViewport(0, 100, 500, 500);

    expect(start).toBe(-100);
    expect(end).toBe(0);
  });
});

describe('zoomViewport', () => {
  it('zooms in (factor < 1) centered at the middle', () => {
    // Use a large range so MIN_TIME_RANGE_SECONDS does not interfere
    const [start, end] = zoomViewport(0, 1000, 0.5, 0.5);

    // Center = 500, new range = 500, centered at 0.5
    expect(start).toBe(250);
    expect(end).toBe(750);
  });

  it('zooms out (factor > 1) centered at the middle', () => {
    const [start, end] = zoomViewport(0, 1000, 2, 0.5);

    // Center = 500, new range = 2000, centered at 0.5
    expect(start).toBe(-500);
    expect(end).toBe(1500);
  });

  it('zooms anchored at the left edge (centerNormalized = 0)', () => {
    const [start, end] = zoomViewport(0, 1000, 0.5, 0);

    expect(start).toBe(0);
    expect(end).toBe(500);
  });

  it('zooms anchored at the right edge (centerNormalized = 1)', () => {
    const [start, end] = zoomViewport(0, 1000, 0.5, 1);

    expect(start).toBe(500);
    expect(end).toBe(1000);
  });

  it('clamps to MIN_TIME_RANGE_SECONDS when zooming too far in', () => {
    const [start, end] = zoomViewport(0, 100, 0.001, 0.5);

    expect(end - start).toBe(MIN_TIME_RANGE_SECONDS);
  });

  it('does not clamp when resulting range exceeds MIN_TIME_RANGE_SECONDS', () => {
    const [start, end] = zoomViewport(0, 10000, 0.5, 0.5);

    expect(end - start).toBe(5000);
  });

  it('preserves center position during zoom', () => {
    const centerNorm = 0.3;
    const originalCenter = 1000 + 9000 * centerNorm;
    const [start, end] = zoomViewport(1000, 10000, 0.5, centerNorm);
    const newCenter = start + (end - start) * centerNorm;

    expect(newCenter).toBeCloseTo(originalCenter);
  });

  it('factor of 1 returns the same viewport', () => {
    expect(zoomViewport(100, 5000, 1, 0.5)).toEqual([100, 5000]);
  });
});
