import { isNil } from 'lodash-es';
import { getTimes } from 'suncalc';
import type { Temporal } from 'temporal-polyfill';

import type { SiteLocation } from '../model/site-plan';
import { fromSunCalcDate, toSunCalcDate } from './sun-position';
import { clampTimeMinutes, MINUTES_PER_DAY, MINUTES_PER_HOUR, resolveMoment } from './sun-study';

/** The lit part of one day at the site, in minutes since local midnight. */
export interface DayWindow {
  readonly sunriseMinutes: number;
  readonly sunsetMinutes: number;
}

/**
 * What the study falls back to when the sun does not cross the horizon at all —
 * the polar day and the polar night both leave the whole calendar day worth
 * sweeping, one of them lit throughout and the other dark throughout.
 */
const FULL_DAY_WINDOW: DayWindow = {
  sunriseMinutes: 0,
  sunsetMinutes: MINUTES_PER_DAY - 1,
};

/** Sun times are asked for at local noon, the middle of the solar day they belong to. */
const NOON_MINUTES = MINUTES_PER_DAY / 2;

export function computeDayWindow({
  date,
  location,
}: {
  readonly date: Temporal.PlainDate;
  readonly location: SiteLocation;
}): DayWindow {
  const noon = resolveMoment({
    date,
    timeMinutes: NOON_MINUTES,
    timeZoneId: location.timeZoneId,
  });
  const times = getTimes(toSunCalcDate(noon), location.latitudeDegrees, location.longitudeDegrees);
  const sunriseMinutes = toLocalMinutes(times.sunrise, date, location.timeZoneId);
  const sunsetMinutes = toLocalMinutes(times.sunset, date, location.timeZoneId);

  // A window that does not open before it closes is no window: it means the
  // sunrise or the sunset landed on a neighbouring local day, which happens
  // wherever the civil time zone is far from the site's own solar time.
  if (isNil(sunriseMinutes) || isNil(sunsetMinutes) || sunsetMinutes <= sunriseMinutes) {
    return FULL_DAY_WINDOW;
  }

  return { sunriseMinutes, sunsetMinutes };
}

/** Keeps a time the user picked on one date inside the daylight of another. */
export function clampTimeToWindow(timeMinutes: number, window: DayWindow): number {
  return Math.min(
    Math.max(clampTimeMinutes(timeMinutes), window.sunriseMinutes),
    window.sunsetMinutes
  );
}

/**
 * A sun time as minutes since local midnight of the day it was asked for.
 * Nothing comes back for an event that does not occur — SunCalc reports the
 * polar day and the polar night as `null`, and older releases as an unusable
 * date — nor for one that falls outside the day being studied.
 */
function toLocalMinutes(
  time: Date | null,
  date: Temporal.PlainDate,
  timeZoneId: string
): number | undefined {
  if (isNil(time) || Number.isNaN(time.getTime())) {
    return undefined;
  }

  const local = fromSunCalcDate(time, timeZoneId);

  return local.toPlainDate().equals(date)
    ? local.hour * MINUTES_PER_HOUR + local.minute
    : undefined;
}
