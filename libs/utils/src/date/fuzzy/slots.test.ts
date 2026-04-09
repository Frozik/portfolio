import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import {
  applyTimeSlotsToZDT,
  assembleZDT,
  buildTimeSlots,
  convertAmPmHour,
  dateToSlots,
  isAmbiguousHour,
  mergeSlots,
  normalizeMilliseconds,
  normalizeYear,
  slotsToPlainDate,
  slotsToPlainTime,
  tryBuildDateFromName,
  tryBuildDateSlots,
} from './slots';
import type { ISlotMap } from './types';

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
