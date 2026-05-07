import { describe, expect, test } from 'vitest';

import { computeBucketViewportStats, computeRadiusPx } from './trades-scaling';
import { ScalingMode } from './trades-types';

const R_MIN_PX = 4;
const R_MAX_PX = 12;

describe('computeBucketViewportStats', () => {
  test('empty volumes collapse to the zero envelope', () => {
    const stats = computeBucketViewportStats([], ScalingMode.Linear);
    expect(stats).toEqual({ mode: ScalingMode.Linear, vMin: 0, vMax: 0 });
  });

  test('linear / log compute true min and max', () => {
    const stats = computeBucketViewportStats([3, 1, 2, 5, 4], ScalingMode.Linear);
    expect(stats.vMin).toBe(1);
    expect(stats.vMax).toBe(5);
  });

  test('percentile clips outliers to the p1 / p99 envelope', () => {
    // 1..100 ascending plus two heavy outliers (1000, 10000).
    const volumes: number[] = [];
    for (let value = 1; value <= 100; value++) {
      volumes.push(value);
    }
    volumes.push(1000, 10000);
    const stats = computeBucketViewportStats(volumes, ScalingMode.Percentile);
    // Outliers should NOT raise vMax — p99 clip pulls it down to ≤ 100.
    expect(stats.vMax).toBeLessThanOrEqual(100);
    // p1 should sit close to the bottom of the distribution.
    expect(stats.vMin).toBeLessThanOrEqual(2);
  });
});

describe('computeRadiusPx', () => {
  test('empty stats fall back to the floor radius', () => {
    const stats = computeBucketViewportStats([], ScalingMode.Linear);
    const radius = computeRadiusPx(42, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Linear);
    expect(radius).toBe(R_MIN_PX);
  });

  test('single-bucket viewport returns floor radius (degenerate range)', () => {
    const stats = computeBucketViewportStats([7], ScalingMode.Linear);
    const radius = computeRadiusPx(7, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Linear);
    expect(radius).toBe(R_MIN_PX);
  });

  test('linear: smallest volume → rMinPx, largest → rMaxPx', () => {
    const stats = computeBucketViewportStats([1, 5, 10], ScalingMode.Linear);
    expect(computeRadiusPx(1, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Linear)).toBeCloseTo(
      R_MIN_PX,
      6
    );
    expect(computeRadiusPx(10, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Linear)).toBeCloseTo(
      R_MAX_PX,
      6
    );
  });

  test('log: same endpoints as linear, but mid-volume differs', () => {
    const volumes = [1, 100];
    const linearStats = computeBucketViewportStats(volumes, ScalingMode.Linear);
    const logStats = computeBucketViewportStats(volumes, ScalingMode.Log);

    // Endpoints match.
    expect(computeRadiusPx(1, logStats, R_MIN_PX, R_MAX_PX, ScalingMode.Log)).toBeCloseTo(
      R_MIN_PX,
      6
    );
    expect(computeRadiusPx(100, logStats, R_MIN_PX, R_MAX_PX, ScalingMode.Log)).toBeCloseTo(
      R_MAX_PX,
      6
    );

    // Mid-volume diverges: linear at v=10 → t=0.0909, log at v=10 → t=0.5.
    const linearAt10 = computeRadiusPx(10, linearStats, R_MIN_PX, R_MAX_PX, ScalingMode.Linear);
    const logAt10 = computeRadiusPx(10, logStats, R_MIN_PX, R_MAX_PX, ScalingMode.Log);
    expect(Math.abs(logAt10 - linearAt10)).toBeGreaterThan(1);
  });

  test('percentile: outlier volumes saturate at rMaxPx, others spread across the range', () => {
    const volumes: number[] = [];
    for (let value = 1; value <= 100; value++) {
      volumes.push(value);
    }
    volumes.push(1000, 10000);
    const stats = computeBucketViewportStats(volumes, ScalingMode.Percentile);

    const outlierRadius = computeRadiusPx(10000, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Percentile);
    expect(outlierRadius).toBeCloseTo(R_MAX_PX, 6);

    // Ordinary volumes stay within the range.
    const midRadius = computeRadiusPx(50, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Percentile);
    expect(midRadius).toBeGreaterThanOrEqual(R_MIN_PX);
    expect(midRadius).toBeLessThanOrEqual(R_MAX_PX);
  });

  test('result is always clamped to [rMinPx, rMaxPx]', () => {
    const stats = computeBucketViewportStats([1, 5, 10], ScalingMode.Linear);

    // Below stats.vMin
    const tinyRadius = computeRadiusPx(0, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Linear);
    expect(tinyRadius).toBeGreaterThanOrEqual(R_MIN_PX);
    expect(tinyRadius).toBeLessThanOrEqual(R_MAX_PX);

    // Above stats.vMax
    const hugeRadius = computeRadiusPx(99, stats, R_MIN_PX, R_MAX_PX, ScalingMode.Linear);
    expect(hugeRadius).toBe(R_MAX_PX);
  });
});
