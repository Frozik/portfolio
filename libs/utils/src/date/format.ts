import { Temporal } from 'temporal-polyfill';

import type { ISO } from './types';

/**
 * Formats an ISO instant as a human-readable `YYYY-MM-DD HH:MM:SS` string in
 * the given time zone (UTC by default). Note: the space separator and dropped
 * offset mean the output is intentionally *not* a valid ISO 8601 string.
 */
export function formatDateTime(iso: ISO, timeZone: Temporal.TimeZoneLike = 'UTC'): string {
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

export function formatDateTimeLocal(iso: ISO): string {
  return formatDateTime(iso, Temporal.Now.timeZoneId());
}
