import { Temporal } from '@js-temporal/polyfill';
import { EDayOfWeek } from './constants';
import { DAYS_IN_WEEK } from './fuzzy/constants';

export * from './constants';
export { parseFuzzyDate } from './fuzzy';
export type { DateTimeParseResult } from './fuzzy/types';
export { stepDateTime } from './stepDateTime';
export * from './types';
export { DAYS_IN_WEEK };

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

export function getStartOfWeek(
  date: Temporal.PlainDate,
  startOfWeek: EDayOfWeek = EDayOfWeek.Monday
): Temporal.PlainDate {
  const diff = date.dayOfWeek - startOfWeek;

  return date.subtract({ days: diff >= 0 ? diff : diff + DAYS_IN_WEEK });
}
