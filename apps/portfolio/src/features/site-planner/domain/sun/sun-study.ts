import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from '@frozik/utils/date/constants';
import { Temporal } from 'temporal-polyfill';

import type { SiteLocation } from '../model/site-plan';

/** Two digits, so a clock readout does not jump about as the slider moves. */
const CLOCK_DIGITS = 2;
const CLOCK_PAD_CHARACTER = '0';
const CLOCK_SEPARATOR = ':';

/**
 * The sun study is authored in local wall-clock time: a date and a number of
 * minutes since midnight at the site. This turns that pair into the instant the
 * astronomy needs, which is also where the site's time zone enters the picture.
 */
export function resolveMoment({
  date,
  timeMinutes,
  timeZoneId,
}: {
  readonly date: Temporal.PlainDate;
  readonly timeMinutes: number;
  readonly timeZoneId: string;
}): Temporal.ZonedDateTime {
  const minutes = clampTimeMinutes(timeMinutes);

  return date.toZonedDateTime({
    timeZone: timeZoneId,
    plainTime: {
      hour: Math.floor(minutes / MINUTES_PER_HOUR),
      minute: minutes % MINUTES_PER_HOUR,
    },
  });
}

/** Midnight belongs to the day, the following midnight does not. */
export function clampTimeMinutes(timeMinutes: number): number {
  return Math.min(Math.max(Math.round(timeMinutes), 0), MINUTES_PER_DAY - 1);
}

/** `HH:MM` — the caption under the time slider. */
export function formatClockTime(timeMinutes: number): string {
  const minutes = clampTimeMinutes(timeMinutes);
  const hourPart = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(
    CLOCK_DIGITS,
    CLOCK_PAD_CHARACTER
  );
  const minutePart = String(minutes % MINUTES_PER_HOUR).padStart(CLOCK_DIGITS, CLOCK_PAD_CHARACTER);

  return `${hourPart}${CLOCK_SEPARATOR}${minutePart}`;
}

/** The date a freshly opened sun study starts on: today, at the site. */
export function today(location: SiteLocation): Temporal.PlainDate {
  return Temporal.Now.plainDateISO(location.timeZoneId);
}
