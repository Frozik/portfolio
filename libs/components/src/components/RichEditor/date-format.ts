import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

export function formatDateOnly(value: Temporal.ZonedDateTime): string {
  return value.toPlainDate().toString();
}

/** `YYYY-MM-DD`, followed by the time down to the last non-zero unit. */
export function defaultFormatDate(value: Temporal.ZonedDateTime): string {
  const dateTime = value.toPlainDateTime();
  const smallestUnit =
    dateTime.millisecond !== 0
      ? 'millisecond'
      : dateTime.second !== 0
        ? 'second'
        : dateTime.hour !== 0 || dateTime.minute !== 0
          ? 'minute'
          : undefined;

  return isNil(smallestUnit)
    ? formatDateOnly(value)
    : dateTime.toString({ smallestUnit }).replace('T', ' ');
}
