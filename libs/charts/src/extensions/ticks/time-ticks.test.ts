import { describe, expect, it } from 'vitest';

import { timeTicks } from './time-ticks';

const SECOND = 1_000_000_000n;
const HOUR = 3600n * SECOND;
const DAY = 24n * HOUR;
/** 1 January 2026, 00:00 UTC. */
const YEAR_START = 1_767_225_600n * SECOND;

function labels(start: bigint, end: bigint, lengthPx = 640): string[] {
  return timeTicks()
    .ticks({ start, end }, lengthPx)
    .map(tick => tick.label);
}

describe('timeTicks', () => {
  it('names months over a year', () => {
    expect(labels(YEAR_START, YEAR_START + 365n * DAY)).toEqual([
      'Jan',
      'Apr',
      'Jul',
      'Oct',
      'Jan',
    ]);
  });

  it('names days over a few weeks, on the midnights of the calendar', () => {
    const ticks = timeTicks().ticks({ start: YEAR_START, end: YEAR_START + 10n * DAY }, 640);

    expect(ticks.map(tick => tick.label)).toEqual(['1', '3', '5', '7', '9', '11']);
    expect(ticks.every(tick => (tick.position - YEAR_START) % DAY === 0n)).toBe(true);
  });

  it('names hours and minutes within a day', () => {
    expect(labels(YEAR_START, YEAR_START + 12n * HOUR)).toEqual([
      '00:00',
      '02:00',
      '04:00',
      '06:00',
      '08:00',
      '10:00',
      '12:00',
    ]);
  });

  it('goes down to seconds and to milliseconds as the range shrinks', () => {
    expect(labels(YEAR_START, YEAR_START + 30n * SECOND)).toContain('00:00:05');
    expect(labels(YEAR_START, YEAR_START + SECOND / 100n)).toContain('00.002');
  });

  it('never puts labels closer than they fit', () => {
    for (const span of [SECOND, 90n * SECOND, 5n * HOUR, 3n * DAY, 40n * DAY, 400n * DAY]) {
      const ticks = timeTicks().ticks({ start: YEAR_START, end: YEAR_START + span }, 400);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks.length).toBeGreaterThan(0);
    }
  });

  it('counts the calendar and the clock in the given time zone', () => {
    const tokyo = timeTicks({ timeZone: 'Asia/Tokyo' }).ticks(
      { start: YEAR_START, end: YEAR_START + 12n * HOUR },
      640
    );

    expect(tokyo[0].label).toBe('10:00');
  });

  it('writes a moment one step finer than the ticks of the range', () => {
    const generator = timeTicks();
    const moment = YEAR_START + 40n * DAY + 5n * HOUR + 7n * SECOND + 123_456_789n;

    expect(generator.format(moment, { start: YEAR_START, end: YEAR_START + 365n * DAY }, 640)).toBe(
      '10 Feb 2026'
    );
    expect(generator.format(moment, { start: moment - DAY, end: moment + 9n * DAY }, 640)).toBe(
      '10 Feb 05:00'
    );
    expect(generator.format(moment, { start: moment - HOUR, end: moment + HOUR }, 640)).toBe(
      '10 Feb 05:00:07'
    );
    expect(generator.format(moment, { start: moment - SECOND, end: moment + SECOND }, 640)).toBe(
      '05:00:07.123456'
    );
  });

  it('has no ticks for an empty range', () => {
    expect(labels(YEAR_START, YEAR_START)).toEqual([]);
  });
});
