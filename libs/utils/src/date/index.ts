import { Temporal } from '@js-temporal/polyfill';
import { EDayOfWeek } from './constants';
import { DAYS_IN_WEEK } from './fuzzy/constants';
import type { ISO } from './types';

export * from './constants';
export { parseFuzzyDate } from './fuzzy';
export type { DateTimeParseResult } from './fuzzy/types';
export { stepDateTime } from './stepDateTime';
export * from './types';
export { DAYS_IN_WEEK };

export function nowEpochMs(): number {
  return ISO8601ToMilliseconds(getNowISO8601());
}

export function getStartOfMonth(yearMonth: Temporal.PlainYearMonth): Temporal.PlainDate {
  return Temporal.PlainDate.from({
    year: yearMonth.year,
    month: yearMonth.month,
    day: 1,
  });
}

export function getEndOfMonth(yearMonth: Temporal.PlainYearMonth): Temporal.PlainDate {
  return Temporal.PlainDate.from({
    year: yearMonth.year,
    month: yearMonth.month,
    day: yearMonth.daysInMonth,
  });
}

export function millisecondsToISO8601(ms: number): ISO {
  return Temporal.Instant.fromEpochMilliseconds(ms).toString() as ISO;
}

export function ISO8601ToMilliseconds(iso: ISO): number {
  return Temporal.Instant.from(iso).epochMilliseconds;
}

export function getNowPlainDate(zone: Temporal.TimeZoneLike = 'UTC'): Temporal.PlainDate {
  const instant = Temporal.Now.instant();
  return instant.toZonedDateTimeISO(zone).toPlainDate();
}

export function getNowISO8601(): ISO {
  return Temporal.Now.instant().toString() as ISO;
}

export function compareISO8601(first: ISO, second: ISO): Temporal.ComparisonResult {
  return Temporal.Instant.compare(Temporal.Instant.from(first), Temporal.Instant.from(second));
}

export function getStartOfWeek(
  date: Temporal.PlainDate,
  startOfWeek: EDayOfWeek = EDayOfWeek.Monday
): Temporal.PlainDate {
  const diff = date.dayOfWeek - startOfWeek;

  return date.subtract({ days: diff >= 0 ? diff : diff + DAYS_IN_WEEK });
}

export function formatISO8601Local(iso: ISO): string {
  return formatISO8601(iso, Temporal.Now.timeZoneId());
}

export function formatISO8601(iso: ISO, timeZone: Temporal.TimeZoneLike = 'UTC'): string {
  const instant = Temporal.Instant.from(iso);
  const zonedDateTime = instant.toZonedDateTimeISO(timeZone);

  const year = String(zonedDateTime.year).padStart(4, '0');
  const month = String(zonedDateTime.month).padStart(2, '0');
  const day = String(zonedDateTime.day).padStart(2, '0');
  const hour = String(zonedDateTime.hour).padStart(2, '0');
  const minute = String(zonedDateTime.minute).padStart(2, '0');
  const second = String(zonedDateTime.second).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
