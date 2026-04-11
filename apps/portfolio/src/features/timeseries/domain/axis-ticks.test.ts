import { Temporal } from '@js-temporal/polyfill';

import { computeXTicks, computeYTicks } from './axis-ticks';
import { GLOBAL_EPOCH_OFFSET } from './constants';
import { ETimeScale } from './types';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/** Wide plot width that avoids thinning for most scales. */
const WIDE_PLOT_PX = 5000;

/** Narrow plot width that forces thinning. */
const NARROW_PLOT_PX = 80;

/** Wide plot height that avoids Y-axis thinning. */
const TALL_PLOT_PX = 800;

/** Short plot height that forces Y-axis thinning. */
const SHORT_PLOT_PX = 40;

function utcEpoch(year: number, month: number, day: number): number {
  const dt = Temporal.ZonedDateTime.from({
    timeZone: 'UTC',
    year,
    month,
    day,
    hour: 0,
    minute: 0,
    second: 0,
  });
  return Number(dt.epochNanoseconds / 1_000_000_000n);
}

describe('computeXTicks', () => {
  describe('ETimeScale.Day256 (month-boundary ticks)', () => {
    it('generates month-boundary ticks within a full year', () => {
      const start = utcEpoch(2026, 1, 1);
      const end = utcEpoch(2026, 12, 31);

      const ticks = computeXTicks(start, end, ETimeScale.Day256, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(1);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(start);
        expect(tick.position).toBeLessThanOrEqual(end);
      }

      // Labels should be short month names like "Jan", "Feb", etc.
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      for (const tick of ticks) {
        expect(monthNames).toContain(tick.label);
      }
    });

    it('returns all 12 months for a full-year range on a wide plot', () => {
      const start = utcEpoch(2026, 1, 1);
      const end = utcEpoch(2027, 1, 1);

      const ticks = computeXTicks(start, end, ETimeScale.Day256, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(12);
    });

    it('returns fewer ticks for a narrow plot due to thinning', () => {
      const start = utcEpoch(2026, 1, 1);
      const end = utcEpoch(2027, 1, 1);

      const wideTicks = computeXTicks(start, end, ETimeScale.Day256, WIDE_PLOT_PX);
      const narrowTicks = computeXTicks(start, end, ETimeScale.Day256, NARROW_PLOT_PX);

      expect(narrowTicks.length).toBeLessThan(wideTicks.length);
    });
  });

  describe('ETimeScale.Day64 (month-boundary ticks)', () => {
    it('generates month-boundary ticks', () => {
      const start = utcEpoch(2026, 1, 1);
      const end = utcEpoch(2026, 6, 30);

      const ticks = computeXTicks(start, end, ETimeScale.Day64, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ETimeScale.Day16 (day-level ticks)', () => {
    it('generates day-level ticks within a single month', () => {
      const start = utcEpoch(2026, 3, 1);
      const end = utcEpoch(2026, 3, 31);

      const ticks = computeXTicks(start, end, ETimeScale.Day16, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(1);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(start);
        expect(tick.position).toBeLessThanOrEqual(end);
      }

      // Labels should be day numbers
      for (const tick of ticks) {
        const day = Number(tick.label);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
      }
    });

    it('generates approximately 30 ticks for a full month on a wide plot', () => {
      const start = utcEpoch(2026, 6, 1);
      const end = utcEpoch(2026, 6, 30);

      const ticks = computeXTicks(start, end, ETimeScale.Day16, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(28);
      expect(ticks.length).toBeLessThanOrEqual(31);
    });

    it('thins ticks for a narrow plot', () => {
      const start = utcEpoch(2026, 6, 1);
      const end = utcEpoch(2026, 6, 30);

      const wideTicks = computeXTicks(start, end, ETimeScale.Day16, WIDE_PLOT_PX);
      const narrowTicks = computeXTicks(start, end, ETimeScale.Day16, NARROW_PLOT_PX);

      expect(narrowTicks.length).toBeLessThan(wideTicks.length);
    });
  });

  describe('ETimeScale.Day4 (day-level ticks)', () => {
    it('generates day-of-week ticks with correct labels', () => {
      const start = utcEpoch(2026, 4, 6);
      const end = utcEpoch(2026, 4, 12);

      const ticks = computeXTicks(start, end, ETimeScale.Day4, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(1);

      for (const tick of ticks) {
        const day = Number(tick.label);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
        expect(tick.position).toBeGreaterThanOrEqual(start);
        expect(tick.position).toBeLessThanOrEqual(end);
      }
    });
  });

  describe('ETimeScale.Day1 (hourly ticks)', () => {
    it('generates hourly ticks with HH:MM labels', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_DAY;

      const ticks = computeXTicks(start, end, ETimeScale.Day1, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(1);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(start);
        expect(tick.position).toBeLessThanOrEqual(end);
        expect(tick.label).toMatch(/^\d{2}:\d{2}$/);
      }
    });

    it('generates approximately 24 ticks for a full day on a wide plot', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_DAY;

      const ticks = computeXTicks(start, end, ETimeScale.Day1, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(23);
      expect(ticks.length).toBeLessThanOrEqual(25);
    });

    it('includes "00:00" at the start of the day', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_DAY;

      const ticks = computeXTicks(start, end, ETimeScale.Day1, WIDE_PLOT_PX);

      const labels = ticks.map(t => t.label);
      expect(labels).toContain('00:00');
    });

    it('thins ticks for a narrow plot', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_DAY;

      const wideTicks = computeXTicks(start, end, ETimeScale.Day1, WIDE_PLOT_PX);
      const narrowTicks = computeXTicks(start, end, ETimeScale.Day1, NARROW_PLOT_PX);

      expect(narrowTicks.length).toBeLessThan(wideTicks.length);
    });
  });

  describe('ETimeScale.Hour12 (per-minute ticks)', () => {
    it('generates per-minute ticks with HH:MM labels', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_HOUR;

      const ticks = computeXTicks(start, end, ETimeScale.Hour12, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(1);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(start);
        expect(tick.position).toBeLessThanOrEqual(end);
        expect(tick.label).toMatch(/^\d{2}:\d{2}$/);
      }
    });

    it('generates approximately 60 raw ticks for a full hour on a wide plot', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_HOUR;

      const ticks = computeXTicks(start, end, ETimeScale.Hour12, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(50);
      expect(ticks.length).toBeLessThanOrEqual(62);
    });

    it('thins ticks for a narrow plot', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_HOUR;

      const wideTicks = computeXTicks(start, end, ETimeScale.Hour12, WIDE_PLOT_PX);
      const narrowTicks = computeXTicks(start, end, ETimeScale.Hour12, NARROW_PLOT_PX);

      expect(narrowTicks.length).toBeLessThan(wideTicks.length);
    });
  });

  describe('ETimeScale.Hour1 (per-minute ticks)', () => {
    it('generates per-minute ticks with HH:MM labels', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_MINUTE;

      const ticks = computeXTicks(start, end, ETimeScale.Hour1, WIDE_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(1);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(start);
        expect(tick.position).toBeLessThanOrEqual(end);
        expect(tick.label).toMatch(/^\d{2}:\d{2}$/);
      }
    });
  });

  describe('edge cases', () => {
    it('returns at most one tick for zero-width range', () => {
      const t = GLOBAL_EPOCH_OFFSET;
      const ticks = computeXTicks(t, t, ETimeScale.Day1, WIDE_PLOT_PX);

      expect(ticks.length).toBeLessThanOrEqual(1);
    });

    it('returns ticks for zero-width plot (thinning returns empty or single)', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_DAY;

      const ticks = computeXTicks(start, end, ETimeScale.Day1, 0);

      expect(ticks.length).toBeGreaterThanOrEqual(1);
    });

    it('tick positions are monotonically increasing', () => {
      const start = GLOBAL_EPOCH_OFFSET;
      const end = GLOBAL_EPOCH_OFFSET + SECONDS_PER_DAY;

      const ticks = computeXTicks(start, end, ETimeScale.Day1, WIDE_PLOT_PX);

      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i].position).toBeGreaterThan(ticks[i - 1].position);
      }
    });
  });
});

describe('computeYTicks', () => {
  describe('normal range', () => {
    it('generates ticks within the value range', () => {
      const ticks = computeYTicks(0, 100, TALL_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(2);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(0);
        expect(tick.position).toBeLessThanOrEqual(100);
      }
    });

    it('generates "nice" step sizes (multiples of 1, 2, or 5 scaled by powers of 10)', () => {
      const ticks = computeYTicks(0, 100, TALL_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(4);
      expect(ticks.length).toBeLessThanOrEqual(12);

      if (ticks.length >= 3) {
        const step = ticks[1].position - ticks[0].position;

        for (let i = 2; i < ticks.length; i++) {
          const currentStep = ticks[i].position - ticks[i - 1].position;
          expect(currentStep).toBeCloseTo(step, 10);
        }
      }
    });

    it('formats labels with appropriate decimal places', () => {
      const ticks = computeYTicks(0, 100, TALL_PLOT_PX);

      for (const tick of ticks) {
        expect(Number.isNaN(Number(tick.label))).toBe(false);
      }
    });
  });

  describe('small range', () => {
    it('handles a very small range with fine-grained ticks', () => {
      const ticks = computeYTicks(0.001, 0.009, TALL_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(2);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(0.001);
        expect(tick.position).toBeLessThanOrEqual(0.009);
      }
    });

    it('uses decimal labels for small ranges', () => {
      const ticks = computeYTicks(1.0, 1.05, TALL_PLOT_PX);

      for (const tick of ticks) {
        expect(tick.label).toContain('.');
      }
    });
  });

  describe('zero range', () => {
    it('returns a single tick when min equals max', () => {
      const ticks = computeYTicks(42, 42, TALL_PLOT_PX);

      expect(ticks).toHaveLength(1);
      expect(ticks[0].position).toBe(42);
    });

    it('formats the single tick label correctly', () => {
      const ticks = computeYTicks(5.5, 5.5, TALL_PLOT_PX);

      expect(ticks).toHaveLength(1);
      expect(ticks[0].label).toBe('5.5');
    });
  });

  describe('large range', () => {
    it('handles a large range with appropriate step sizes', () => {
      const ticks = computeYTicks(0, 1_000_000, TALL_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks.length).toBeLessThanOrEqual(12);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(0);
        expect(tick.position).toBeLessThanOrEqual(1_000_000);
      }
    });
  });

  describe('negative values', () => {
    it('handles a purely negative range', () => {
      const ticks = computeYTicks(-100, -10, TALL_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(2);

      for (const tick of ticks) {
        expect(tick.position).toBeGreaterThanOrEqual(-100);
        expect(tick.position).toBeLessThanOrEqual(-10);
      }
    });

    it('handles a range spanning zero', () => {
      const ticks = computeYTicks(-50, 50, TALL_PLOT_PX);

      expect(ticks.length).toBeGreaterThanOrEqual(2);

      const hasNegative = ticks.some(t => t.position < 0);
      const hasPositive = ticks.some(t => t.position > 0);

      expect(hasNegative).toBe(true);
      expect(hasPositive).toBe(true);
    });

    it('formats negative labels with a minus sign', () => {
      const ticks = computeYTicks(-100, -10, TALL_PLOT_PX);

      for (const tick of ticks) {
        expect(tick.label.startsWith('-')).toBe(true);
      }
    });
  });

  describe('thinning at small plotHeight', () => {
    it('returns fewer ticks for a short plot', () => {
      const tallTicks = computeYTicks(0, 100, TALL_PLOT_PX);
      const shortTicks = computeYTicks(0, 100, SHORT_PLOT_PX);

      expect(shortTicks.length).toBeLessThan(tallTicks.length);
    });

    it('returns at least one tick even for a very short plot', () => {
      const ticks = computeYTicks(0, 100, 1);

      expect(ticks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('tick positions are monotonically increasing', () => {
    it('ticks are sorted in ascending order', () => {
      const ticks = computeYTicks(0, 100, TALL_PLOT_PX);

      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i].position).toBeGreaterThan(ticks[i - 1].position);
      }
    });
  });

  describe('label precision', () => {
    it('uses integer labels for large step sizes', () => {
      const ticks = computeYTicks(0, 1000, TALL_PLOT_PX);

      for (const tick of ticks) {
        const parts = tick.label.split('.');

        if (parts.length > 1) {
          expect(parts[1].length).toBeLessThanOrEqual(2);
        }
      }
    });

    it('uses more decimal places for small step sizes', () => {
      const ticks = computeYTicks(0, 0.01, TALL_PLOT_PX);

      const hasDecimals = ticks.some(t => t.label.includes('.'));
      expect(hasDecimals).toBe(true);
    });
  });
});
