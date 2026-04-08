import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import {
  applyOffsetSlots,
  applyTimeSlotsToZDT,
  assembleZDT,
  buildTimeSlots,
  convertAmPmHour,
  dateToSlots,
  isAmbiguousHour,
  mergeSlots,
  negateDuration,
  normalizeMilliseconds,
  normalizeYear,
  parseDDMMYYYYSlots,
  resolveMonthNameToSlots,
  resolveNextWeekdaySlots,
  resolveOrdinalDaySlots,
  resolvePartialDayMonthNumericSlots,
  resolvePartialDayMonthSlots,
  resolvePreviousWeekdaySlots,
  resolveQuarterSlots,
  slotsToPlainDate,
  slotsToPlainTime,
  tryBuildDateFromName,
  tryBuildDateSlots,
  unitToDuration,
} from './slot-utils';
import type { ISlotMap } from './token-types';

const TIME_ZONE = 'UTC';

describe('mergeSlots', () => {
  it('merges two slot maps', () => {
    const a: ISlotMap = { year: 2024, month: 1 };
    const b: ISlotMap = { day: 15 };
    expect(mergeSlots(a, b)).toEqual({ year: 2024, month: 1, day: 15 });
  });

  it('slot b overrides slot a', () => {
    const a: ISlotMap = { year: 2024, month: 1, day: 10 };
    const b: ISlotMap = { day: 20 };
    expect(mergeSlots(a, b)).toEqual({ year: 2024, month: 1, day: 20 });
  });

  it('handles empty slot maps', () => {
    expect(mergeSlots({}, {})).toEqual({});
    expect(mergeSlots({ year: 2024 }, {})).toEqual({ year: 2024 });
    expect(mergeSlots({}, { month: 3 })).toEqual({ month: 3 });
  });
});

describe('dateToSlots', () => {
  it('converts PlainDate to slot map', () => {
    const date = Temporal.PlainDate.from('2024-03-15');
    expect(dateToSlots(date)).toEqual({ year: 2024, month: 3, day: 15 });
  });

  it('handles first day of year', () => {
    const date = Temporal.PlainDate.from('2025-01-01');
    expect(dateToSlots(date)).toEqual({ year: 2025, month: 1, day: 1 });
  });

  it('handles last day of year', () => {
    const date = Temporal.PlainDate.from('2024-12-31');
    expect(dateToSlots(date)).toEqual({ year: 2024, month: 12, day: 31 });
  });
});

describe('slotsToPlainDate', () => {
  it('converts complete slots to PlainDate', () => {
    const slots: ISlotMap = { year: 2024, month: 6, day: 15 };
    expect(slotsToPlainDate(slots)?.toString()).toBe('2024-06-15');
  });

  it('returns undefined when year is missing', () => {
    expect(slotsToPlainDate({ month: 6, day: 15 })).toBeUndefined();
  });

  it('returns undefined when month is missing', () => {
    expect(slotsToPlainDate({ year: 2024, day: 15 })).toBeUndefined();
  });

  it('returns undefined when day is missing', () => {
    expect(slotsToPlainDate({ year: 2024, month: 6 })).toBeUndefined();
  });

  it('returns undefined for invalid date (Feb 30)', () => {
    expect(slotsToPlainDate({ year: 2024, month: 2, day: 30 })).toBeUndefined();
  });

  it('accepts Feb 29 on leap year', () => {
    expect(slotsToPlainDate({ year: 2024, month: 2, day: 29 })?.toString()).toBe('2024-02-29');
  });

  it('rejects Feb 29 on non-leap year', () => {
    expect(slotsToPlainDate({ year: 2023, month: 2, day: 29 })).toBeUndefined();
  });
});

describe('slotsToPlainTime', () => {
  it('converts full time slots', () => {
    const slots: ISlotMap = { hour: 14, minute: 30, second: 45, ms: 123 };
    expect(slotsToPlainTime(slots)?.toString()).toBe('14:30:45.123');
  });

  it('defaults minute, second, ms to 0 when missing', () => {
    expect(slotsToPlainTime({ hour: 10 })?.toString()).toBe('10:00:00');
  });

  it('returns undefined when hour is missing', () => {
    expect(slotsToPlainTime({ minute: 30 })).toBeUndefined();
  });

  it('returns undefined for invalid hour', () => {
    expect(slotsToPlainTime({ hour: 25 })).toBeUndefined();
  });

  it('handles midnight', () => {
    expect(slotsToPlainTime({ hour: 0, minute: 0, second: 0 })?.toString()).toBe('00:00:00');
  });
});

describe('applyTimeSlotsToZDT', () => {
  const baseZDT = Temporal.ZonedDateTime.from('2024-06-15T08:00:00[UTC]');

  it('applies time slots to a ZonedDateTime', () => {
    const result = applyTimeSlotsToZDT(baseZDT, { hour: 14, minute: 30 });
    expect(result?.toPlainTime().toString()).toBe('14:30:00');
    expect(result?.toPlainDate().toString()).toBe('2024-06-15');
  });

  it('returns undefined when time slots have no hour', () => {
    expect(applyTimeSlotsToZDT(baseZDT, { minute: 30 })).toBeUndefined();
  });
});

describe('normalizeYear', () => {
  it('converts 2-digit year below cutoff to 2000s', () => {
    expect(normalizeYear('25')).toBe(2025);
    expect(normalizeYear('0')).toBe(2000);
    expect(normalizeYear('49')).toBe(2049);
  });

  it('converts 2-digit year at or above cutoff to 1900s', () => {
    expect(normalizeYear('50')).toBe(1950);
    expect(normalizeYear('99')).toBe(1999);
  });

  it('passes through 4-digit years unchanged', () => {
    expect(normalizeYear('2024')).toBe(2024);
    expect(normalizeYear('1999')).toBe(1999);
  });

  it('handles single-digit years', () => {
    expect(normalizeYear('5')).toBe(2005);
  });

  it('passes through 3-digit years unchanged', () => {
    expect(normalizeYear('100')).toBe(100);
  });
});

describe('convertAmPmHour', () => {
  it('converts 12am to 0 (midnight)', () => {
    expect(convertAmPmHour(12, 'am')).toBe(0);
  });

  it('converts 12pm to 12 (noon)', () => {
    expect(convertAmPmHour(12, 'pm')).toBe(12);
  });

  it('converts am hours (1-11)', () => {
    expect(convertAmPmHour(1, 'am')).toBe(1);
    expect(convertAmPmHour(11, 'am')).toBe(11);
  });

  it('converts pm hours (1-11)', () => {
    expect(convertAmPmHour(1, 'pm')).toBe(13);
    expect(convertAmPmHour(11, 'pm')).toBe(23);
  });

  it('is case-insensitive', () => {
    expect(convertAmPmHour(3, 'PM')).toBe(15);
    expect(convertAmPmHour(3, 'Am')).toBe(3);
  });

  it('returns undefined for hour 0', () => {
    expect(convertAmPmHour(0, 'am')).toBeUndefined();
  });

  it('returns undefined for hour > 12', () => {
    expect(convertAmPmHour(13, 'pm')).toBeUndefined();
  });
});

describe('normalizeMilliseconds', () => {
  it('pads short strings to 3 digits', () => {
    expect(normalizeMilliseconds('1')).toBe(100);
    expect(normalizeMilliseconds('12')).toBe(120);
  });

  it('keeps 3-digit strings as-is', () => {
    expect(normalizeMilliseconds('123')).toBe(123);
  });

  it('truncates long strings (padEnd has no effect)', () => {
    expect(normalizeMilliseconds('1234')).toBe(1234);
  });
});

describe('buildTimeSlots', () => {
  it('builds valid time slots', () => {
    expect(buildTimeSlots(14, 30, 0, 0)).toEqual({
      hour: 14,
      minute: 30,
      second: 0,
      ms: 0,
    });
  });

  it('returns undefined for invalid hour', () => {
    expect(buildTimeSlots(25, 0, 0, 0)).toBeUndefined();
  });

  it('returns undefined for invalid minute', () => {
    expect(buildTimeSlots(12, 60, 0, 0)).toBeUndefined();
  });

  it('returns undefined for invalid second', () => {
    expect(buildTimeSlots(12, 0, 60, 0)).toBeUndefined();
  });

  it('accepts midnight', () => {
    expect(buildTimeSlots(0, 0, 0, 0)).toEqual({
      hour: 0,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('accepts end of day time', () => {
    expect(buildTimeSlots(23, 59, 59, 999)).toEqual({
      hour: 23,
      minute: 59,
      second: 59,
      ms: 999,
    });
  });
});

describe('tryBuildDateSlots', () => {
  it('builds valid date slots', () => {
    expect(tryBuildDateSlots(2024, 6, 15)).toEqual({ year: 2024, month: 6, day: 15 });
  });

  it('returns undefined for invalid date', () => {
    expect(tryBuildDateSlots(2024, 13, 1)).toBeUndefined();
    expect(tryBuildDateSlots(2024, 2, 30)).toBeUndefined();
  });

  it('accepts leap day', () => {
    expect(tryBuildDateSlots(2024, 2, 29)).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('rejects leap day on non-leap year', () => {
    expect(tryBuildDateSlots(2023, 2, 29)).toBeUndefined();
  });
});

describe('tryBuildDateFromName', () => {
  it('builds date slots from month name', () => {
    expect(tryBuildDateFromName(15, 'june', 2024)).toEqual({ year: 2024, month: 6, day: 15 });
  });

  it('handles abbreviated month names', () => {
    expect(tryBuildDateFromName(1, 'jan', 2025)).toEqual({ year: 2025, month: 1, day: 1 });
  });

  it('is case-insensitive', () => {
    expect(tryBuildDateFromName(25, 'DEC', 2024)).toEqual({ year: 2024, month: 12, day: 25 });
  });

  it('returns undefined for unknown month name', () => {
    expect(tryBuildDateFromName(1, 'xyz', 2024)).toBeUndefined();
  });

  it('returns undefined for invalid day', () => {
    expect(tryBuildDateFromName(31, 'feb', 2024)).toBeUndefined();
  });
});

describe('unitToDuration', () => {
  it('maps day units', () => {
    expect(unitToDuration('d', 5)).toEqual({ days: 5 });
    expect(unitToDuration('day', 3)).toEqual({ days: 3 });
  });

  it('maps week units', () => {
    expect(unitToDuration('w', 2)).toEqual({ weeks: 2 });
    expect(unitToDuration('week', 1)).toEqual({ weeks: 1 });
  });

  it('maps month units', () => {
    expect(unitToDuration('m', 6)).toEqual({ months: 6 });
    expect(unitToDuration('month', 3)).toEqual({ months: 3 });
  });

  it('maps year units', () => {
    expect(unitToDuration('y', 1)).toEqual({ years: 1 });
    expect(unitToDuration('year', 10)).toEqual({ years: 10 });
  });

  it('uses absolute value of amount', () => {
    expect(unitToDuration('d', -5)).toEqual({ days: 5 });
  });

  it('defaults to days for unknown units', () => {
    expect(unitToDuration('unknown', 3)).toEqual({ days: 3 });
  });

  it('is case-insensitive', () => {
    expect(unitToDuration('D', 1)).toEqual({ days: 1 });
    expect(unitToDuration('WEEK', 2)).toEqual({ weeks: 2 });
  });
});

describe('negateDuration', () => {
  it('copies duration fields without negating them', () => {
    const duration = { years: 1, months: 2, weeks: 3, days: 4 };
    const result = negateDuration(duration);
    expect(result).toEqual({ years: 1, months: 2, weeks: 3, days: 4 });
  });

  it('handles undefined fields', () => {
    const result = negateDuration({ days: 5 });
    expect(result).toEqual({
      years: undefined,
      months: undefined,
      weeks: undefined,
      days: 5,
    });
  });
});

describe('parseDDMMYYYYSlots', () => {
  it('parses valid DD/MM/YYYY', () => {
    expect(parseDDMMYYYYSlots('15', '06', '2024')).toEqual({
      year: 2024,
      month: 6,
      day: 15,
    });
  });

  it('returns undefined for invalid date', () => {
    expect(parseDDMMYYYYSlots('31', '02', '2024')).toBeUndefined();
  });

  it('handles single-digit day and month', () => {
    expect(parseDDMMYYYYSlots('1', '1', '2025')).toEqual({
      year: 2025,
      month: 1,
      day: 1,
    });
  });
});

describe('isAmbiguousHour', () => {
  it('returns true for 2-digit values <= 23', () => {
    expect(isAmbiguousHour('00')).toBe(true);
    expect(isAmbiguousHour('23')).toBe(true);
    expect(isAmbiguousHour('12')).toBe(true);
  });

  it('returns false for 2-digit values > 23', () => {
    expect(isAmbiguousHour('24')).toBe(false);
    expect(isAmbiguousHour('99')).toBe(false);
  });

  it('returns true for single-digit values', () => {
    expect(isAmbiguousHour('5')).toBe(true);
    expect(isAmbiguousHour('0')).toBe(true);
  });

  it('returns false for 3+ digit values', () => {
    expect(isAmbiguousHour('100')).toBe(false);
    expect(isAmbiguousHour('2024')).toBe(false);
  });
});

describe('assembleZDT', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it('assembles full slots into ZonedDateTime', () => {
    const slots: ISlotMap = {
      year: 2024,
      month: 3,
      day: 10,
      hour: 14,
      minute: 30,
      second: 0,
      ms: 0,
    };
    const result = assembleZDT(slots, today, TIME_ZONE);
    expect(result?.toString()).toContain('2024-03-10T14:30:00');
  });

  it('fills missing slots from today and defaults', () => {
    const result = assembleZDT({ month: 1, day: 5 }, today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2024-01-05');
    expect(result?.toPlainTime().toString()).toBe('00:00:00');
  });

  it('uses today year/month/day when slots are empty', () => {
    const result = assembleZDT({}, today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2024-06-15');
  });

  it('clamps overflow dates (PlainDate.from default behavior)', () => {
    const result = assembleZDT({ month: 2, day: 30 }, today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2024-02-29');
  });
});

describe('resolveNextWeekdaySlots', () => {
  const monday = Temporal.PlainDate.from('2024-01-08');

  it('resolves next Tuesday from Monday', () => {
    expect(resolveNextWeekdaySlots('tue', monday)).toEqual({
      year: 2024,
      month: 1,
      day: 9,
    });
  });

  it('resolves same weekday to next week', () => {
    expect(resolveNextWeekdaySlots('mon', monday)).toEqual({
      year: 2024,
      month: 1,
      day: 15,
    });
  });

  it('resolves Sunday from Monday', () => {
    expect(resolveNextWeekdaySlots('sun', monday)).toEqual({
      year: 2024,
      month: 1,
      day: 14,
    });
  });

  it('returns undefined for invalid day name', () => {
    expect(resolveNextWeekdaySlots('xyz', monday)).toBeUndefined();
  });

  it('handles full day names', () => {
    expect(resolveNextWeekdaySlots('friday', monday)).toEqual({
      year: 2024,
      month: 1,
      day: 12,
    });
  });
});

describe('resolvePreviousWeekdaySlots', () => {
  const wednesday = Temporal.PlainDate.from('2024-01-10');

  it('resolves previous Monday from Wednesday', () => {
    expect(resolvePreviousWeekdaySlots('mon', wednesday)).toEqual({
      year: 2024,
      month: 1,
      day: 8,
    });
  });

  it('resolves same weekday to previous week', () => {
    expect(resolvePreviousWeekdaySlots('wed', wednesday)).toEqual({
      year: 2024,
      month: 1,
      day: 3,
    });
  });

  it('resolves previous Friday from Wednesday', () => {
    expect(resolvePreviousWeekdaySlots('fri', wednesday)).toEqual({
      year: 2024,
      month: 1,
      day: 5,
    });
  });

  it('returns undefined for invalid day name', () => {
    expect(resolvePreviousWeekdaySlots('xyz', wednesday)).toBeUndefined();
  });
});

describe('resolvePartialDayMonthSlots', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it('resolves future day+month in current year', () => {
    expect(resolvePartialDayMonthSlots(25, 'dec', today)).toEqual({
      year: 2024,
      month: 12,
      day: 25,
    });
  });

  it('resolves past day+month to next year', () => {
    expect(resolvePartialDayMonthSlots(1, 'jan', today)).toEqual({
      year: 2025,
      month: 1,
      day: 1,
    });
  });

  it('returns undefined for unknown month', () => {
    expect(resolvePartialDayMonthSlots(1, 'xyz', today)).toBeUndefined();
  });

  it('returns undefined for invalid day in month', () => {
    expect(resolvePartialDayMonthSlots(31, 'feb', today)).toBeUndefined();
  });
});

describe('resolvePartialDayMonthNumericSlots', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it('resolves future date in current year', () => {
    expect(resolvePartialDayMonthNumericSlots(1, 12, today)).toEqual({
      year: 2024,
      month: 12,
      day: 1,
    });
  });

  it('resolves past date to next year', () => {
    expect(resolvePartialDayMonthNumericSlots(1, 1, today)).toEqual({
      year: 2025,
      month: 1,
      day: 1,
    });
  });

  it('resolves today to current year (same or later)', () => {
    expect(resolvePartialDayMonthNumericSlots(15, 6, today)).toEqual({
      year: 2024,
      month: 6,
      day: 15,
    });
  });

  it('resolves yesterday to next year', () => {
    expect(resolvePartialDayMonthNumericSlots(14, 6, today)).toEqual({
      year: 2025,
      month: 6,
      day: 14,
    });
  });
});

describe('resolveOrdinalDaySlots', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it('resolves future day in current month', () => {
    expect(resolveOrdinalDaySlots(20, today)).toEqual({
      year: 2024,
      month: 6,
      day: 20,
    });
  });

  it('resolves today to current month', () => {
    expect(resolveOrdinalDaySlots(15, today)).toEqual({
      year: 2024,
      month: 6,
      day: 15,
    });
  });

  it('resolves past day to next month', () => {
    expect(resolveOrdinalDaySlots(10, today)).toEqual({
      year: 2024,
      month: 7,
      day: 10,
    });
  });

  it('wraps to next year from December', () => {
    const dec = Temporal.PlainDate.from('2024-12-20');
    expect(resolveOrdinalDaySlots(5, dec)).toEqual({
      year: 2025,
      month: 1,
      day: 5,
    });
  });

  it('handles day 31 that does not exist in next month', () => {
    const june30 = Temporal.PlainDate.from('2024-06-30');
    expect(resolveOrdinalDaySlots(31, june30)).toEqual({
      year: 2024,
      month: 7,
      day: 31,
    });
  });
});

describe('resolveMonthNameToSlots', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it('resolves future month in current year', () => {
    expect(resolveMonthNameToSlots('dec', today)).toEqual({
      year: 2024,
      month: 12,
      day: 1,
    });
  });

  it('resolves past month to next year', () => {
    expect(resolveMonthNameToSlots('jan', today)).toEqual({
      year: 2025,
      month: 1,
      day: 1,
    });
  });

  it('resolves current month (past day 1) to next year', () => {
    expect(resolveMonthNameToSlots('june', today)).toEqual({
      year: 2025,
      month: 6,
      day: 1,
    });
  });

  it('resolves current month on day 1 to current year', () => {
    const june1 = Temporal.PlainDate.from('2024-06-01');
    expect(resolveMonthNameToSlots('june', june1)).toEqual({
      year: 2024,
      month: 6,
      day: 1,
    });
  });

  it('returns undefined for unknown month', () => {
    expect(resolveMonthNameToSlots('xyz', today)).toBeUndefined();
  });
});

describe('applyOffsetSlots', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it('adds days forward', () => {
    expect(applyOffsetSlots(today, 5, 'd', 1)).toEqual({
      year: 2024,
      month: 6,
      day: 20,
    });
  });

  it('subtracts days backward', () => {
    expect(applyOffsetSlots(today, 5, 'd', -1)).toEqual({
      year: 2024,
      month: 6,
      day: 10,
    });
  });

  it('adds months forward', () => {
    expect(applyOffsetSlots(today, 3, 'm', 1)).toEqual({
      year: 2024,
      month: 9,
      day: 15,
    });
  });

  it('adds weeks forward', () => {
    expect(applyOffsetSlots(today, 2, 'w', 1)).toEqual({
      year: 2024,
      month: 6,
      day: 29,
    });
  });

  it('adds years forward', () => {
    expect(applyOffsetSlots(today, 1, 'y', 1)).toEqual({
      year: 2025,
      month: 6,
      day: 15,
    });
  });
});

describe('resolveQuarterSlots', () => {
  it('resolves Q1', () => {
    expect(resolveQuarterSlots(1, 2024)).toEqual({ year: 2024, month: 1, day: 1 });
  });

  it('resolves Q2', () => {
    expect(resolveQuarterSlots(2, 2024)).toEqual({ year: 2024, month: 4, day: 1 });
  });

  it('resolves Q3', () => {
    expect(resolveQuarterSlots(3, 2024)).toEqual({ year: 2024, month: 7, day: 1 });
  });

  it('resolves Q4', () => {
    expect(resolveQuarterSlots(4, 2024)).toEqual({ year: 2024, month: 10, day: 1 });
  });

  it('returns undefined for invalid quarter', () => {
    expect(resolveQuarterSlots(0, 2024)).toBeUndefined();
    expect(resolveQuarterSlots(5, 2024)).toBeUndefined();
  });
});
