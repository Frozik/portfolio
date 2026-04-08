import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';
import type { ISlotMap } from './token-types';
import {
  applyOffsetToSlots,
  assembleZDT,
  parseDirectDateToSlots,
  parseStandaloneTimeToSlots,
  resolveKeywordToSlots,
  resolveMonthNameToSlots,
  resolveMonthYearToSlots,
  resolveNextWeekdayToSlots,
  resolvePreviousWeekdayToSlots,
  resolveQuarterToSlots,
} from './tokenParser';

function assembleDate(slots: ISlotMap): Temporal.PlainDate | undefined {
  if (isNil(slots.year) || isNil(slots.month) || isNil(slots.day)) {
    return undefined;
  }
  try {
    return Temporal.PlainDate.from({ year: slots.year, month: slots.month, day: slots.day });
  } catch {
    return undefined;
  }
}

/**
 * Resolve day name abbreviation (mon, tue, monday, tuesday, etc.) to next occurrence.
 * If today is the named day, returns NEXT week's occurrence.
 */
export function resolveNextWeekday(
  dayName: string,
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const slots = resolveNextWeekdayToSlots(dayName, today);
  if (isNil(slots)) {
    return undefined;
  }
  return assembleDate(slots);
}

/**
 * Resolve previous occurrence of a weekday (last monday, last friday).
 * If today is the named day, returns PREVIOUS week's occurrence.
 */
export function resolvePreviousWeekday(
  dayName: string,
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const slots = resolvePreviousWeekdayToSlots(dayName, today);
  if (isNil(slots)) {
    return undefined;
  }
  return assembleDate(slots);
}

/**
 * Resolve keyword to a ZonedDateTime.
 * Supports: yesterday, tomorrow, today, now, noon,
 * eom/bom/eoy/boy and their long forms.
 */
export function resolveKeyword(
  keyword: string,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  const slots = resolveKeywordToSlots(keyword, today);
  if (isNil(slots)) {
    return undefined;
  }
  return assembleZDT(slots, today, timeZone);
}

/**
 * Resolve a month name to the 1st of the nearest future occurrence.
 * If the month hasn't occurred yet this year, use this year.
 * If the month has already passed, use next year.
 */
export function resolveMonthName(
  monthName: string,
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const slots = resolveMonthNameToSlots(monthName, today);
  if (isNil(slots)) {
    return undefined;
  }
  return assembleDate(slots);
}

/**
 * Resolve a month name + year to the 1st of that month.
 */
export function resolveMonthYear(monthName: string, year: number): Temporal.PlainDate | undefined {
  const slots = resolveMonthYearToSlots(monthName, year);
  if (isNil(slots)) {
    return undefined;
  }
  return assembleDate(slots);
}

/**
 * Resolve a quarter reference to the start of that quarter.
 */
export function resolveQuarter(quarter: number, year: number): Temporal.PlainDate | undefined {
  const slots = resolveQuarterToSlots(quarter, year);
  if (isNil(slots)) {
    return undefined;
  }
  return assembleDate(slots);
}

/**
 * Apply an offset (days, weeks, months, years) to a date.
 */
export function applyOffset(
  today: Temporal.PlainDate,
  amount: number,
  unit: string,
  direction: 1 | -1
): Temporal.PlainDate {
  const slots = applyOffsetToSlots(today, amount, unit, direction);
  const result = assembleDate(slots);
  if (isNil(result)) {
    return today;
  }
  return result;
}

/**
 * Try parsing a date string in common numeric formats:
 * - ISO: 2021-01-29
 * - ISO datetime: 2021-01-29T14:30
 * - Slash: DD/MM/YYYY
 * - Dot: DD.MM.YYYY
 * - Dash: DD-MM-YYYY (when first segment > 12)
 */
export function parseDirectDate(
  input: string,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  const slots = parseDirectDateToSlots(input, timeZone);
  if (isNil(slots)) {
    return undefined;
  }
  const sentinel = Temporal.PlainDate.from({ year: 1970, month: 1, day: 1 });
  return assembleZDT(slots, sentinel, timeZone);
}

/** Parse a standalone time expression: "13:00", "9:30:45.123", "9am", "5:30pm" */
export function parseStandaloneTime(input: string): Temporal.PlainTime | undefined {
  const slots = parseStandaloneTimeToSlots(input);
  if (isNil(slots)) {
    return undefined;
  }
  try {
    return new Temporal.PlainTime(
      slots.hour ?? 0,
      slots.minute ?? 0,
      slots.second ?? 0,
      slots.ms ?? 0
    );
  } catch {
    return undefined;
  }
}
