import { describe, expect, it } from 'vitest';

import { timeDomain } from '../../core/viewport/time-domain';
import { linearTickAxis } from '../../testing/tick-axis';
import { timeTicks } from './time-ticks';

const SECOND = 1_000_000_000n;
const HOUR = 3600n * SECOND;
const DAY = 24n * HOUR;
/** 1 January 2026, 00:00 UTC. */
const YEAR_START = 1_767_225_600n * SECOND;

function axis(start: bigint, end: bigint, lengthPx = 640, timeZone?: string) {
  return linearTickAxis(timeDomain({ timeZone }), { start, end }, lengthPx);
}

function labels(start: bigint, end: bigint, lengthPx = 640): string[] {
  return timeTicks()
    .ticks(axis(start, end, lengthPx))
    .map(tick => tick.label);
}

describe('timeTicks', () => {
  it('names months over a year, and the year where it begins', () => {
    expect(labels(YEAR_START, YEAR_START + 365n * DAY)).toEqual([
      '2026',
      'Apr',
      'Jul',
      'Oct',
      '2027',
    ]);
  });

  it('names days over a few weeks, on the midnights of the calendar, and the month on its first', () => {
    const ticks = timeTicks().ticks(axis(YEAR_START, YEAR_START + 10n * DAY, 640));

    expect(ticks.map(tick => tick.label)).toEqual(['2026', '3', '5', '7', '9', '11']);
    expect(ticks.every(tick => (tick.position - YEAR_START) % DAY === 0n)).toBe(true);
  });

  it('counts weeks from the first of each month, so every month is named', () => {
    expect(labels(YEAR_START + 20n * DAY, YEAR_START + 80n * DAY, 720)).toEqual([
      '22',
      'Feb',
      '8',
      '15',
      '22',
      'Mar',
      '8',
      '15',
      '22',
    ]);
  });

  it('keeps the name of a calendar tick that a cut swallowed, standing at the edge of the cut', () => {
    const cutAxis = axis(YEAR_START - 200n * DAY, YEAR_START + 165n * DAY, 640);
    const swallowed = {
      ...cutAxis,
      // Nothing is shown from four days before the year to two days into it.
      shownAt: (position: bigint) =>
        position > YEAR_START - 4n * DAY && position < YEAR_START + 2n * DAY
          ? YEAR_START + 2n * DAY
          : position,
    };

    const ticks = timeTicks().ticks(swallowed);
    const atCut = ticks.find(tick => tick.position === YEAR_START + 2n * DAY);

    expect(atCut?.label).toBe('2026');
  });

  it('gives a tick that begins a larger unit the room over a plain one next to it', () => {
    // Half-years over two years, with the July before 2026 squeezed up against January: January still wins.
    const july2025 = YEAR_START - 184n * DAY;
    const crowded = {
      ...axis(YEAR_START - 365n * DAY, YEAR_START + 365n * DAY, 640),
      pixelOf: (position: bigint): number => {
        const even = (Number(position - YEAR_START) / Number(730n * DAY)) * 640 + 320;
        return position === july2025 ? 290 : even;
      },
    };

    const labels = timeTicks()
      .ticks(crowded)
      .map(tick => tick.label);

    expect(labels).toEqual(['2025', '2026', 'Jul', '2027']);
  });

  it('names hours and minutes within a day, and the date at midnight', () => {
    expect(labels(YEAR_START, YEAR_START + 12n * HOUR)).toEqual([
      '1 Jan',
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
      const ticks = timeTicks().ticks(axis(YEAR_START, YEAR_START + span, 400));
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks.length).toBeGreaterThan(0);
    }
  });

  it('counts the calendar and the clock in the zone of the axis', () => {
    const tokyo = timeTicks().ticks(axis(YEAR_START, YEAR_START + 12n * HOUR, 640, 'Asia/Tokyo'));

    expect(tokyo[0].label).toBe('10:00');
  });

  it('writes a moment one step finer than the ticks of the range', () => {
    const generator = timeTicks();
    const moment = YEAR_START + 40n * DAY + 5n * HOUR + 7n * SECOND + 123_456_789n;

    expect(generator.format(moment, axis(YEAR_START, YEAR_START + 365n * DAY))).toBe('10 Feb 2026');
    expect(generator.format(moment, axis(moment - DAY, moment + 9n * DAY))).toBe('10 Feb 05:00');
    expect(generator.format(moment, axis(moment - HOUR, moment + HOUR))).toBe('10 Feb 05:00:07');
    expect(generator.format(moment, axis(moment - SECOND, moment + SECOND))).toBe(
      '05:00:07.123456'
    );
  });

  it('has no ticks for an empty range', () => {
    expect(labels(YEAR_START, YEAR_START)).toEqual([]);
  });
});
