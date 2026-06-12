import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import {
  buildTimeSlots,
  convertAmPmHour,
  dateToSlots,
  normalizeMilliseconds,
  normalizeYear,
  slotsToPlainDate,
  slotsToPlainTime,
  tryBuildDateSlots,
} from './slots';
import type { ISlotMap } from './types';

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
