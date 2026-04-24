import { Temporal } from 'temporal-polyfill';

import type { ISO } from './types';

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

export function formatISO8601Local(iso: ISO): string {
  return formatISO8601(iso, Temporal.Now.timeZoneId());
}
