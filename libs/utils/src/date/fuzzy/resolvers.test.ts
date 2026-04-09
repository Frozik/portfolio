import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import {
  applyOffsetSlots,
  resolveMonthNameToSlots,
  resolveNextWeekdaySlots,
  resolveOrdinalDaySlots,
  resolvePartialDayMonthNumericSlots,
  resolvePartialDayMonthSlots,
  resolvePreviousWeekdaySlots,
  resolveQuarterSlots,
} from './resolvers';

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
