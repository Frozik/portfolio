import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { DEFAULT_TIME_ZONE_ID } from '../constants';
import { clampTimeMinutes, formatClockTime, MINUTES_PER_DAY, resolveMoment } from './sun-study';

const SOLSTICE = Temporal.PlainDate.from('2026-06-21');

describe('resolveMoment', () => {
  it('reads the minutes as local wall-clock time at the site', () => {
    const moment = resolveMoment({
      date: SOLSTICE,
      timeMinutes: 13 * 60 + 45,
      timeZoneId: DEFAULT_TIME_ZONE_ID,
    });

    expect(moment.hour).toBe(13);
    expect(moment.minute).toBe(45);
    expect(moment.timeZoneId).toBe(DEFAULT_TIME_ZONE_ID);
  });

  it('keeps the last minute of the day on that day', () => {
    const moment = resolveMoment({
      date: SOLSTICE,
      timeMinutes: MINUTES_PER_DAY,
      timeZoneId: DEFAULT_TIME_ZONE_ID,
    });

    expect(moment.toPlainDate().equals(SOLSTICE)).toBe(true);
    expect(moment.hour).toBe(23);
    expect(moment.minute).toBe(59);
  });
});

describe('clampTimeMinutes', () => {
  it('rounds a fractional slider value to the minute', () => {
    expect(clampTimeMinutes(61.4)).toBe(61);
  });

  it('holds the day open at both ends', () => {
    expect(clampTimeMinutes(-30)).toBe(0);
    expect(clampTimeMinutes(MINUTES_PER_DAY * 2)).toBe(MINUTES_PER_DAY - 1);
  });
});

describe('formatClockTime', () => {
  it('pads both parts to two digits', () => {
    expect(formatClockTime(5 * 60 + 7)).toBe('05:07');
  });

  it('reads midnight as the start of the day', () => {
    expect(formatClockTime(0)).toBe('00:00');
  });
});
