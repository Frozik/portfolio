import { FULL_YEAR_SECONDS, GLOBAL_EPOCH_OFFSET } from './constants';
import { generateTimeseriesData } from './data-generator';
import { ETimeScale } from './types';

const DEFAULT_SEED = 'test-seed';

describe('generateTimeseriesData', () => {
  const yearStart = GLOBAL_EPOCH_OFFSET;
  const yearEnd = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS;

  describe('point counts per scale', () => {
    const UNIFORM_POINT_COUNT = 180;

    const expectedCounts: Record<string, { scale: ETimeScale; count: number }> = {
      Hour1: { scale: ETimeScale.Hour1, count: UNIFORM_POINT_COUNT },
      Hour12: { scale: ETimeScale.Hour12, count: UNIFORM_POINT_COUNT },
      Day1: { scale: ETimeScale.Day1, count: UNIFORM_POINT_COUNT },
      Day4: { scale: ETimeScale.Day4, count: UNIFORM_POINT_COUNT },
      Day16: { scale: ETimeScale.Day16, count: UNIFORM_POINT_COUNT },
      Day64: { scale: ETimeScale.Day64, count: UNIFORM_POINT_COUNT },
      Day256: { scale: ETimeScale.Day256, count: UNIFORM_POINT_COUNT },
    };

    for (const [name, { scale, count }] of Object.entries(expectedCounts)) {
      it(`${name} scale returns ${count} points`, () => {
        const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
        const range = 3600;
        const points = generateTimeseriesData(
          midpoint - range,
          midpoint + range,
          scale,
          DEFAULT_SEED
        );

        expect(points.length).toBe(count);
      });
    }
  });

  describe('determinism', () => {
    it('produces identical results when called twice with the same parameters', () => {
      const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
      const range = 7200;

      const first = generateTimeseriesData(
        midpoint - range,
        midpoint + range,
        ETimeScale.Day1,
        DEFAULT_SEED
      );
      const second = generateTimeseriesData(
        midpoint - range,
        midpoint + range,
        ETimeScale.Day1,
        DEFAULT_SEED
      );

      expect(first.length).toBe(second.length);

      for (let index = 0; index < first.length; index++) {
        expect(first[index].time).toBe(second[index].time);
        expect(first[index].value).toBe(second[index].value);
        expect(first[index].size).toBe(second[index].size);
        expect(first[index].color).toBe(second[index].color);
      }
    });

    it('Day256 scale is deterministic across calls', () => {
      const first = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Day256, DEFAULT_SEED);
      const second = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Day256, DEFAULT_SEED);

      expect(first.length).toBe(second.length);

      for (let index = 0; index < first.length; index++) {
        expect(first[index].time).toBe(second[index].time);
        expect(first[index].value).toBe(second[index].value);
      }
    });
  });

  describe('different seeds produce different data', () => {
    it('two different seeds produce different values', () => {
      const points1 = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Day256, 'seed-alpha');
      const points2 = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Day256, 'seed-beta');

      expect(points1.length).toBe(points2.length);

      const hasDifference = points1.some((point, index) => point.value !== points2[index].value);
      expect(hasDifference).toBe(true);
    });
  });

  describe('data integrity', () => {
    it('all points have time within the requested range', () => {
      const points = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Day256, DEFAULT_SEED);

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

      const points = generateTimeseriesData(start, end, ETimeScale.Hour1, DEFAULT_SEED);

      for (const point of points) {
        expect(point.time).toBeGreaterThanOrEqual(start);
        expect(point.time).toBeLessThanOrEqual(end);
      }
    });

    it('all values are finite numbers', () => {
      const points = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Day256, DEFAULT_SEED);

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

      const points = generateTimeseriesData(
        midpoint - range,
        midpoint + range,
        ETimeScale.Hour1,
        DEFAULT_SEED
      );

      for (const point of points) {
        expect(Number.isFinite(point.value)).toBe(true);
        expect(Number.isFinite(point.time)).toBe(true);
      }
    });

    it('all sizes are positive', () => {
      const points = generateTimeseriesData(yearStart, yearEnd, ETimeScale.Day256, DEFAULT_SEED);

      for (const point of points) {
        expect(point.size).toBeGreaterThan(0);
      }
    });

    it('all sizes are positive for finer scales', () => {
      const midpoint = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS / 2;
      const range = 3600;

      const points = generateTimeseriesData(
        midpoint - range,
        midpoint + range,
        ETimeScale.Day1,
        DEFAULT_SEED
      );

      for (const point of points) {
        expect(point.size).toBeGreaterThan(0);
      }
    });
  });
});
