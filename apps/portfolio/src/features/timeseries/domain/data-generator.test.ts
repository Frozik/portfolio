import { FULL_YEAR_SECONDS, GLOBAL_EPOCH_OFFSET } from './constants';
import { generateTimeseriesData } from './data-generator';
import { ETimeScale } from './types';

describe('generateTimeseriesData', () => {
  const yearStart = GLOBAL_EPOCH_OFFSET;
  const yearEnd = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS;

  describe('Year scale', () => {
    it('returns approximately 366 points for the full year range', () => {
      const points = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);

      // Backbone has 366 points; filtering to [yearStart, yearEnd] should return most of them
      expect(points.length).toBeGreaterThanOrEqual(360);
      expect(points.length).toBeLessThanOrEqual(366);
    });

    it('returns fewer points for a partial year range', () => {
      const halfYearEnd = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
      const points = generateTimeseriesData(yearStart, halfYearEnd, ETimeScale.Year);

      expect(points.length).toBeGreaterThan(0);
      expect(points.length).toBeLessThan(366);
    });

    it('returns empty array when range is outside backbone', () => {
      const farFuture = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS * 10;
      const points = generateTimeseriesData(farFuture, farFuture + 1000, ETimeScale.Year);

      expect(points).toEqual([]);
    });
  });

  describe('finer scales return correct point counts', () => {
    const expectedCounts: Record<string, { scale: ETimeScale; count: number }> = {
      Month: { scale: ETimeScale.Month, count: 300 },
      Week: { scale: ETimeScale.Week, count: 168 },
      Day: { scale: ETimeScale.Day, count: 480 },
      Hour: { scale: ETimeScale.Hour, count: 360 },
      Minute: { scale: ETimeScale.Minute, count: 60 },
    };

    for (const [name, { scale, count }] of Object.entries(expectedCounts)) {
      it(`${name} scale returns ${count} points`, () => {
        const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
        const range = 3600; // 1 hour window
        const points = generateTimeseriesData(midpoint - range, midpoint + range, scale);

        expect(points.length).toBe(count);
      });
    }
  });

  describe('determinism', () => {
    it('produces identical results when called twice with the same parameters', () => {
      const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
      const range = 7200;

      const first = generateTimeseriesData(midpoint - range, midpoint + range, ETimeScale.Day);
      const second = generateTimeseriesData(midpoint - range, midpoint + range, ETimeScale.Day);

      expect(first.length).toBe(second.length);

      for (let i = 0; i < first.length; i++) {
        expect(first[i].time).toBe(second[i].time);
        expect(first[i].value).toBe(second[i].value);
        expect(first[i].size).toBe(second[i].size);
        expect(first[i].color).toBe(second[i].color);
      }
    });

    it('Year scale is deterministic across calls', () => {
      const first = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);
      const second = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);

      expect(first.length).toBe(second.length);

      for (let i = 0; i < first.length; i++) {
        expect(first[i].time).toBe(second[i].time);
        expect(first[i].value).toBe(second[i].value);
      }
    });
  });

  describe('data integrity', () => {
    it('all points have time within the requested range (Year scale)', () => {
      const points = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);

      for (const point of points) {
        expect(point.time).toBeGreaterThanOrEqual(yearStart);
        expect(point.time).toBeLessThanOrEqual(yearEnd);
      }
    });

    it('all points have time within the requested range (finer scales)', () => {
      const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
      const range = 3600;
      const start = midpoint - range;
      const end = midpoint + range;

      const points = generateTimeseriesData(start, end, ETimeScale.Hour);

      for (const point of points) {
        expect(point.time).toBeGreaterThanOrEqual(start);
        expect(point.time).toBeLessThanOrEqual(end);
      }
    });

    it('all values are finite numbers', () => {
      const points = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);

      for (const point of points) {
        expect(Number.isFinite(point.value)).toBe(true);
        expect(Number.isFinite(point.time)).toBe(true);
        expect(Number.isFinite(point.size)).toBe(true);
        expect(Number.isFinite(point.color)).toBe(true);
      }
    });

    it('all values are finite for finer scales', () => {
      const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
      const range = 3600;

      const points = generateTimeseriesData(midpoint - range, midpoint + range, ETimeScale.Minute);

      for (const point of points) {
        expect(Number.isFinite(point.value)).toBe(true);
        expect(Number.isFinite(point.time)).toBe(true);
      }
    });

    it('all sizes are positive', () => {
      const points = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);

      for (const point of points) {
        expect(point.size).toBeGreaterThan(0);
      }
    });

    it('all sizes are positive for finer scales', () => {
      const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
      const range = 3600;

      const points = generateTimeseriesData(midpoint - range, midpoint + range, ETimeScale.Day);

      for (const point of points) {
        expect(point.size).toBeGreaterThan(0);
      }
    });
  });

  describe('backbone caching', () => {
    it('returns consistent backbone values across multiple Year-scale calls', () => {
      // First call populates the cache; second call uses it
      const firstCall = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);
      const secondCall = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);

      expect(firstCall.length).toBe(secondCall.length);

      for (let i = 0; i < firstCall.length; i++) {
        expect(firstCall[i].time).toBe(secondCall[i].time);
        expect(firstCall[i].value).toBe(secondCall[i].value);
      }
    });

    it('interpolated scales produce values consistent with backbone', () => {
      // Get backbone points at Year scale
      const backbone = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Year);

      // Pick a backbone point in the middle
      const midIndex = Math.floor(backbone.length / 2);
      const midTime = backbone[midIndex].time;
      const midValue = backbone[midIndex].value;

      // Generate at Month scale around that exact time
      const narrow = 60; // very small window
      const finePoints = generateTimeseriesData(
        midTime - narrow,
        midTime + narrow,
        ETimeScale.Month
      );

      // The interpolated value near the backbone point should be close to the backbone value
      // (noise amplitude for Month is small: 0.15)
      const closestPoint = finePoints.reduce((closest, p) =>
        Math.abs(p.time - midTime) < Math.abs(closest.time - midTime) ? p : closest
      );

      expect(closestPoint.value).toBeCloseTo(midValue, 0);
    });
  });
});
