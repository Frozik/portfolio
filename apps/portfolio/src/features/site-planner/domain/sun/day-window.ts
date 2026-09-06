import { computeSolarEvents } from '@frozik/utils/astronomy/solarEvents';
import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

import type { SiteLocation } from '../model/site-plan';
import { clampTimeMinutes, resolveMoment } from './sun-study';

/** The lit part of one day at the site, in minutes since local midnight. */
export interface DayWindow {
  readonly sunriseMinutes: number;
  readonly sunsetMinutes: number;
}

/** Sunrise and sunset as local instants; either is absent when the sun never crosses the horizon. */
export interface SunTimes {
  readonly sunrise: Temporal.ZonedDateTime | undefined;
  readonly sunset: Temporal.ZonedDateTime | undefined;
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
  const noon = resolveMoment({ date, timeMinutes: NOON_MINUTES, timeZoneId: location.timeZoneId });
  const events = computeSolarEvents(
    noon.toInstant(),
    location.latitudeDegrees,
    location.longitudeDegrees
  );

  return resolveDayWindow(
    {
      sunrise: events.sunrise?.toZonedDateTimeISO(location.timeZoneId),
      sunset: events.sunset?.toZonedDateTimeISO(location.timeZoneId),
    },
    date
  );
}

export function resolveDayWindow(times: SunTimes, date: Temporal.PlainDate): DayWindow {
  const sunriseMinutes = toLocalMinutes(times.sunrise, date);
  const sunsetMinutes = toLocalMinutes(times.sunset, date);

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

/** A sun time as minutes since local midnight, or nothing when it falls outside the studied day. */
function toLocalMinutes(
  time: Temporal.ZonedDateTime | undefined,
  date: Temporal.PlainDate
): number | undefined {
  if (isNil(time)) {
    return undefined;
  }

  return time.toPlainDate().equals(date) ? time.hour * MINUTES_PER_HOUR + time.minute : undefined;
}
