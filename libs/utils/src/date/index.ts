import { Temporal } from '@js-temporal/polyfill';
import { EDayOfWeek } from '../types';

export {
  applyOffset,
  parseDirectDate,
  parseStandaloneTime,
  resolveKeyword,
  resolveMonthName,
  resolveMonthYear,
  resolveNextWeekday,
  resolvePreviousWeekday,
  resolveQuarter,
} from './date-utils';
export { parseFuzzyDate } from './parseFuzzyDate';
export { stepDateTime } from './stepDateTime';
export type { ISlotMap } from './token-types';
export * from './types';

export const DAYS_IN_WEEK = 7;

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
