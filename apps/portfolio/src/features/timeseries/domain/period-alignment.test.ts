import { alignedPeriods } from './period-alignment';
import { ETimeScale } from './types';

describe('alignedPeriods', () => {
  describe('basic alignment', () => {
    it('returns periods aligned to scale boundaries for Hour1', () => {
      const duration = ETimeScale.Hour1; // 3600 seconds
      const viewStart = 7000; // slightly before 2 * 3600
      const viewEnd = 8000; // slightly after 2 * 3600

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Hour1, 0);

      // Floor(7000/3600) * 3600 = 1 * 3600 = 3600
      // Ceil(8000/3600) * 3600 = 3 * 3600 = 10800
      expect(periods).toHaveLength(2);
      expect(periods[0].start).toBe(1 * duration);
      expect(periods[0].end).toBe(2 * duration);
      expect(periods[1].start).toBe(2 * duration);
      expect(periods[1].end).toBe(3 * duration);
    });

    it('returns a single period when viewport fits exactly within one period', () => {
      const duration = ETimeScale.Day1; // 86400 seconds
      const viewStart = duration;
      const viewEnd = 2 * duration;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Day1, 0);

      expect(periods).toHaveLength(1);
      expect(periods[0].start).toBe(duration);
      expect(periods[0].end).toBe(2 * duration);
    });

    it('returns multiple periods for a wide viewport', () => {
      const duration = ETimeScale.Hour1;
      const viewStart = 0;
      const viewEnd = 5 * duration;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Hour1, 0);

      expect(periods).toHaveLength(5);

      for (let index = 0; index < periods.length; index++) {
        expect(periods[index].start).toBe(index * duration);
        expect(periods[index].end).toBe((index + 1) * duration);
      }
    });
  });

  describe('buffer periods', () => {
    it('adds 1 buffer period on each side by default', () => {
      const duration = ETimeScale.Hour1;
      const viewStart = duration;
      const viewEnd = 2 * duration;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Hour1);

      // 1 period covering the viewport + 1 buffer on each side = 3
      expect(periods).toHaveLength(3);
      expect(periods[0].start).toBe(0);
      expect(periods[2].end).toBe(3 * duration);
    });

    it('adds specified buffer periods on each side', () => {
      const duration = ETimeScale.Hour1;
      const viewStart = 2 * duration;
      const viewEnd = 3 * duration;
      const bufferCount = 2;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Hour1, bufferCount);

      // 1 period covering viewport + 2 buffers each side = 5
      expect(periods).toHaveLength(5);
      expect(periods[0].start).toBe(0);
      expect(periods[4].end).toBe(5 * duration);
    });

    it('adds no buffer when bufferPeriods is 0', () => {
      const duration = ETimeScale.Day1;
      const viewStart = 0;
      const viewEnd = duration;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Day1, 0);

      expect(periods).toHaveLength(1);
      expect(periods[0].start).toBe(0);
      expect(periods[0].end).toBe(duration);
    });
  });

  describe('alignment edge cases', () => {
    it('aligns correctly when viewStart is exactly on a boundary', () => {
      const duration = ETimeScale.Hour1;
      const viewStart = 3 * duration;
      const viewEnd = 3 * duration + 1;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Hour1, 0);

      expect(periods).toHaveLength(1);
      expect(periods[0].start).toBe(3 * duration);
      expect(periods[0].end).toBe(4 * duration);
    });

    it('aligns correctly when viewEnd is exactly on a boundary', () => {
      const duration = ETimeScale.Hour1;
      const viewStart = 2 * duration - 1;
      const viewEnd = 3 * duration;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Hour1, 0);

      expect(periods).toHaveLength(2);
      expect(periods[0].start).toBe(1 * duration);
      expect(periods[1].end).toBe(3 * duration);
    });

    it('handles negative time values', () => {
      const duration = ETimeScale.Hour1;
      const viewStart = -duration - 1;
      const viewEnd = -1;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Hour1, 0);

      expect(periods).toHaveLength(2);
      expect(periods[0].start).toBe(-2 * duration);
      expect(periods[1].end).toBe(0);
    });

    it('consecutive periods have no gaps', () => {
      const periods = alignedPeriods(0, 100000, ETimeScale.Hour1, 1);

      for (let index = 1; index < periods.length; index++) {
        expect(periods[index].start).toBe(periods[index - 1].end);
      }
    });

    it('all periods have duration equal to scale value', () => {
      const duration = ETimeScale.Day4;
      const periods = alignedPeriods(0, 10 * duration, ETimeScale.Day4, 1);

      for (const period of periods) {
        expect(period.end - period.start).toBe(duration);
      }
    });
  });

  describe('different scales', () => {
    it('works with Day256 scale', () => {
      const duration = ETimeScale.Day256;
      const viewStart = 0;
      const viewEnd = duration;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Day256, 0);

      expect(periods).toHaveLength(1);
      expect(periods[0].start).toBe(0);
      expect(periods[0].end).toBe(duration);
    });

    it('works with Day16 scale', () => {
      const duration = ETimeScale.Day16;
      const viewStart = duration / 2;
      const viewEnd = duration * 1.5;

      const periods = alignedPeriods(viewStart, viewEnd, ETimeScale.Day16, 0);

      expect(periods).toHaveLength(2);
      expect(periods[0].start).toBe(0);
      expect(periods[0].end).toBe(duration);
      expect(periods[1].start).toBe(duration);
      expect(periods[1].end).toBe(2 * duration);
    });
  });
});
