import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

/** The date part kept within `[minDate, maxDate]`, the time of day untouched. */
export function clampToDateRange(
  dateTime: Temporal.ZonedDateTime,
  {
    minDate,
    maxDate,
  }: { readonly minDate?: Temporal.PlainDate; readonly maxDate?: Temporal.PlainDate }
): Temporal.ZonedDateTime {
  const date = dateTime.toPlainDate();
  const timeZone = dateTime.timeZoneId;
  if (!isNil(minDate) && Temporal.PlainDate.compare(date, minDate) < 0) {
    return minDate.toZonedDateTime({ timeZone, plainTime: dateTime.toPlainTime() });
  }
  if (!isNil(maxDate) && Temporal.PlainDate.compare(date, maxDate) > 0) {
    return maxDate.toZonedDateTime({ timeZone, plainTime: dateTime.toPlainTime() });
  }
  return dateTime;
}
