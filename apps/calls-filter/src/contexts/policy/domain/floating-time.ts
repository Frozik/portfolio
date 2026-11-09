import type { Brand } from '@frozik/utils/types/base';
import { Temporal } from 'temporal-polyfill';

/**
 * Minutes of local wall-clock time since 1970-01-01 00:00, in no time zone: a schedule
 * follows the clock wherever the phone is, so «night» in Helsinki is Helsinki's night.
 * Kotlin counts the same way (`LocalDateTime.toEpochSecond(ZoneOffset.UTC) / 60`).
 */
export type TFloatingMinute = Brand<number, 'FloatingMinute'>;

const MILLISECONDS_PER_MINUTE = 60_000;
export const MINUTES_PER_DAY = 1440;

export function floatingMinute(dateTime: Temporal.PlainDateTime): TFloatingMinute {
  return Math.floor(
    dateTime.toZonedDateTime('UTC').epochMilliseconds / MILLISECONDS_PER_MINUTE
  ) as TFloatingMinute;
}

export function floatingDateStart(date: Temporal.PlainDate): TFloatingMinute {
  return floatingMinute(date.toPlainDateTime());
}

export function plainDateTimeOf(minute: TFloatingMinute): Temporal.PlainDateTime {
  return Temporal.Instant.fromEpochMilliseconds(minute * MILLISECONDS_PER_MINUTE)
    .toZonedDateTimeISO('UTC')
    .toPlainDateTime();
}
