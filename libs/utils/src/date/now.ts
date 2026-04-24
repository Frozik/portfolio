import { Temporal } from 'temporal-polyfill';

import { ISO8601ToMilliseconds } from './iso8601';
import type { ISO } from './types';

export function nowEpochMs(): number {
  return ISO8601ToMilliseconds(getNowISO8601());
}

export function getNowPlainDate(zone: Temporal.TimeZoneLike = 'UTC'): Temporal.PlainDate {
  const instant = Temporal.Now.instant();
  return instant.toZonedDateTimeISO(zone).toPlainDate();
}

export function getNowISO8601(): ISO {
  return Temporal.Now.instant().toString() as ISO;
}
