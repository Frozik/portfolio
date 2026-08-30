import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LATITUDE_DEGREES,
  DEFAULT_LONGITUDE_DEGREES,
  DEFAULT_NORTH_OFFSET_DEGREES,
  DEFAULT_TIME_ZONE_ID,
} from '../constants';
import type { SiteLocation } from '../model/site-plan';
import { clampTimeToWindow, computeDayWindow } from './day-window';
import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from './sun-study';

const SAINT_PETERSBURG: SiteLocation = {
  latitudeDegrees: DEFAULT_LATITUDE_DEGREES,
  longitudeDegrees: DEFAULT_LONGITUDE_DEGREES,
  timeZoneId: DEFAULT_TIME_ZONE_ID,
  northOffsetDegrees: DEFAULT_NORTH_OFFSET_DEGREES,
};

/** Longyearbyen: polar day in June, polar night in December. */
const SVALBARD: SiteLocation = {
  latitudeDegrees: 78.22,
  longitudeDegrees: 15.65,
  timeZoneId: 'Europe/Oslo',
  northOffsetDegrees: 0,
};

const SUMMER_SOLSTICE = Temporal.PlainDate.from('2026-06-21');
const WINTER_SOLSTICE = Temporal.PlainDate.from('2026-12-21');

describe('computeDayWindow', () => {
  it('spans a summer solstice day in Saint Petersburg from early morning to late evening', () => {
    const { sunriseMinutes, sunsetMinutes } = computeDayWindow({
      date: SUMMER_SOLSTICE,
      location: SAINT_PETERSBURG,
    });

    expect(sunriseMinutes / MINUTES_PER_HOUR).toBeCloseTo(3.6, 1);
    expect(sunsetMinutes / MINUTES_PER_HOUR).toBeCloseTo(22.4, 1);
  });

  it('leaves a much shorter window at the winter solstice', () => {
    const summer = computeDayWindow({ date: SUMMER_SOLSTICE, location: SAINT_PETERSBURG });
    const winter = computeDayWindow({ date: WINTER_SOLSTICE, location: SAINT_PETERSBURG });

    expect(winter.sunsetMinutes - winter.sunriseMinutes).toBeLessThan(
      summer.sunsetMinutes - summer.sunriseMinutes
    );
    expect(winter.sunriseMinutes).toBeGreaterThan(summer.sunriseMinutes);
  });

  it('falls back to the whole day through a polar day', () => {
    expect(computeDayWindow({ date: SUMMER_SOLSTICE, location: SVALBARD })).toEqual({
      sunriseMinutes: 0,
      sunsetMinutes: MINUTES_PER_DAY - 1,
    });
  });

  it('falls back to the whole day through a polar night', () => {
    expect(computeDayWindow({ date: WINTER_SOLSTICE, location: SVALBARD })).toEqual({
      sunriseMinutes: 0,
      sunsetMinutes: MINUTES_PER_DAY - 1,
    });
  });
});

describe('clampTimeToWindow', () => {
  const window = { sunriseMinutes: 300, sunsetMinutes: 1200 };

  it('keeps a time inside the daylight', () => {
    expect(clampTimeToWindow(700, window)).toBe(700);
  });

  it('lifts a time before the sunrise onto it', () => {
    expect(clampTimeToWindow(0, window)).toBe(300);
  });

  it('pulls a time after the sunset back onto it', () => {
    expect(clampTimeToWindow(MINUTES_PER_DAY, window)).toBe(1200);
  });
});
