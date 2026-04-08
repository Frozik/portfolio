import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';

import {
  MAX_AMBIGUOUS_HOUR,
  MONTHS_IN_YEAR,
  MS_PAD_LENGTH,
  TWO_DIGIT_YEAR_BASE_HIGH,
  TWO_DIGIT_YEAR_BASE_LOW,
  TWO_DIGIT_YEAR_CUTOFF,
} from './constants';
import { MONTH_MAP, QUARTER_START_MONTH, WEEKDAY_MAP } from './lookups';
import type { ISlotMap } from './token-types';

export function mergeSlots(a: ISlotMap, b: ISlotMap): ISlotMap {
  return { ...a, ...b };
}

export function dateToSlots(date: Temporal.PlainDate): ISlotMap {
  return { year: date.year, month: date.month, day: date.day };
}

export function slotsToPlainDate(slots: ISlotMap): Temporal.PlainDate | undefined {
  if (isNil(slots.year) || isNil(slots.month) || isNil(slots.day)) {
    return undefined;
  }
  try {
    return Temporal.PlainDate.from(
      { year: slots.year, month: slots.month, day: slots.day },
      { overflow: 'reject' }
    );
  } catch {
    return undefined;
  }
}

export function slotsToPlainTime(slots: ISlotMap): Temporal.PlainTime | undefined {
  if (isNil(slots.hour)) {
    return undefined;
  }
  try {
    return new Temporal.PlainTime(slots.hour, slots.minute ?? 0, slots.second ?? 0, slots.ms ?? 0);
  } catch {
    return undefined;
  }
}

export function applyTimeSlotsToZDT(
  zdt: Temporal.ZonedDateTime,
  timeSlots: ISlotMap
): Temporal.ZonedDateTime | undefined {
  const time = slotsToPlainTime(timeSlots);
  if (isNil(time)) {
    return undefined;
  }
  return zdt.withPlainTime(time);
}

export function normalizeYear(yearStr: string): number {
  const n = Number(yearStr);
  if (yearStr.length <= 2) {
    return n < TWO_DIGIT_YEAR_CUTOFF ? TWO_DIGIT_YEAR_BASE_LOW + n : TWO_DIGIT_YEAR_BASE_HIGH + n;
  }
  return n;
}

export function convertAmPmHour(hour: number, ampm: string): number | undefined {
  const NOON = 12;
  if (hour < 1 || hour > NOON) {
    return undefined;
  }
  const isPm = ampm.toLowerCase() === 'pm';
  if (hour === NOON) {
    return isPm ? NOON : 0;
  }
  return isPm ? hour + NOON : hour;
}

export function normalizeMilliseconds(ms: string): number {
  return Number(ms.padEnd(MS_PAD_LENGTH, '0'));
}

export function buildTimeSlots(
  hour: number,
  minute: number,
  second: number,
  millisecond: number
): ISlotMap | undefined {
  try {
    new Temporal.PlainTime(hour, minute, second, millisecond);
    return { hour, minute, second, ms: millisecond };
  } catch {
    return undefined;
  }
}

export function tryBuildDateSlots(year: number, month: number, day: number): ISlotMap | undefined {
  try {
    Temporal.PlainDate.from({ year, month, day }, { overflow: 'reject' });
    return { year, month, day };
  } catch {
    return undefined;
  }
}

export function tryBuildDateFromName(
  day: number,
  monthName: string,
  year: number
): ISlotMap | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  return tryBuildDateSlots(year, month, day);
}

export function unitToDuration(unit: string, amount: number): Temporal.DurationLike {
  const absAmount = Math.abs(amount);

  switch (unit.toLowerCase()) {
    case 'd':
    case 'day':
      return { days: absAmount };
    case 'w':
    case 'week':
      return { weeks: absAmount };
    case 'm':
    case 'month':
      return { months: absAmount };
    case 'y':
    case 'year':
      return { years: absAmount };
    default:
      return { days: absAmount };
  }
}

export function negateDuration(duration: Temporal.DurationLike): Temporal.DurationLike {
  return {
    years: duration.years,
    months: duration.months,
    weeks: duration.weeks,
    days: duration.days,
  };
}

export function parseDDMMYYYYSlots(
  dayStr: string,
  monthStr: string,
  yearStr: string
): ISlotMap | undefined {
  return tryBuildDateSlots(Number(yearStr), Number(monthStr), Number(dayStr));
}

export function isAmbiguousHour(yearStr: string): boolean {
  return yearStr.length <= 2 && Number(yearStr) <= MAX_AMBIGUOUS_HOUR;
}

export function maybeSnap(
  date: Temporal.ZonedDateTime,
  getNextBusinessTime?: (date: Temporal.ZonedDateTime) => Temporal.ZonedDateTime
): Temporal.ZonedDateTime {
  if (isNil(getNextBusinessTime)) {
    return date;
  }
  return getNextBusinessTime(date);
}

export function assembleZDT(
  slots: ISlotMap,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  const year = slots.year ?? today.year;
  const month = slots.month ?? today.month;
  const day = slots.day ?? today.day;
  const hour = slots.hour ?? 0;
  const minute = slots.minute ?? 0;
  const second = slots.second ?? 0;
  const ms = slots.ms ?? 0;

  try {
    const date = Temporal.PlainDate.from({ year, month, day });
    const time = new Temporal.PlainTime(hour, minute, second, ms);
    return date.toZonedDateTime({ timeZone, plainTime: time });
  } catch {
    return undefined;
  }
}

export function resolveNextWeekdaySlots(
  dayName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const DAYS_IN_WEEK = 7;
  const targetDay = WEEKDAY_MAP.get(dayName.toLowerCase());

  if (isNil(targetDay)) {
    return undefined;
  }

  const currentDay = today.dayOfWeek;
  const daysUntil = (targetDay - currentDay + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const offset = daysUntil === 0 ? DAYS_IN_WEEK : daysUntil;

  return dateToSlots(today.add({ days: offset }));
}

export function resolvePreviousWeekdaySlots(
  dayName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const DAYS_IN_WEEK = 7;
  const targetDay = WEEKDAY_MAP.get(dayName.toLowerCase());

  if (isNil(targetDay)) {
    return undefined;
  }

  const currentDay = today.dayOfWeek;
  const daysSince = (currentDay - targetDay + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const offset = daysSince === 0 ? DAYS_IN_WEEK : daysSince;

  return dateToSlots(today.subtract({ days: offset }));
}

export function resolvePartialDayMonthSlots(
  day: number,
  monthName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  return resolvePartialDayMonthNumericSlots(day, month, today);
}

export function resolvePartialDayMonthNumericSlots(
  day: number,
  month: number,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const thisYear = tryBuildDateSlots(today.year, month, day);
  if (!isNil(thisYear)) {
    const thisYearDate = Temporal.PlainDate.from({
      year: today.year,
      month,
      day,
    });
    if (Temporal.PlainDate.compare(thisYearDate, today) >= 0) {
      return thisYear;
    }
  }
  return tryBuildDateSlots(today.year + 1, month, day);
}

export function resolveOrdinalDaySlots(
  day: number,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const thisMonth = tryBuildDateSlots(today.year, today.month, day);
  if (!isNil(thisMonth)) {
    const thisMonthDate = Temporal.PlainDate.from({
      year: today.year,
      month: today.month,
      day,
    });
    if (Temporal.PlainDate.compare(thisMonthDate, today) >= 0) {
      return thisMonth;
    }
  }
  const nextMonth = today.month === MONTHS_IN_YEAR ? 1 : today.month + 1;
  const nextYear = today.month === MONTHS_IN_YEAR ? today.year + 1 : today.year;
  return tryBuildDateSlots(nextYear, nextMonth, day);
}

export function resolveMonthNameToSlots(
  monthName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  const year =
    month > today.month || (month === today.month && today.day === 1) ? today.year : today.year + 1;

  return { year, month, day: 1 };
}

export function applyOffsetSlots(
  today: Temporal.PlainDate,
  amount: number,
  unit: string,
  direction: 1 | -1
): ISlotMap {
  const signedAmount = amount * direction;
  const duration = unitToDuration(unit, signedAmount);

  const result = signedAmount >= 0 ? today.add(duration) : today.subtract(negateDuration(duration));

  return dateToSlots(result);
}

export function resolveQuarterSlots(quarter: number, year: number): ISlotMap | undefined {
  const startMonth = QUARTER_START_MONTH.get(quarter);

  if (isNil(startMonth)) {
    return undefined;
  }

  return tryBuildDateSlots(year, startMonth, 1);
}
