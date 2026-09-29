import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { EDayOfWeek } from '../../constants';
import { EEdge, EOffsetUnit, EPeriod } from '../lexer/token';
import {
  boundaryDate,
  firstMonthOfQuarter,
  nextWeekday,
  plainDateOf,
  previousWeekday,
  shifted,
  thisWeekday,
  weekendOf,
} from './calendar';

describe('plainDateOf', () => {
  it('builds a date the calendar has', () => {
    expect(plainDateOf(2024, 6, 15)?.toString()).toBe('2024-06-15');
    expect(plainDateOf(2024, 2, 29)?.toString()).toBe('2024-02-29');
  });

  it.each([
    [2024, 2, 30],
    [2023, 2, 29],
    [2024, 6, 31],
    [2024, 13, 1],
    [2024, 0, 1],
    [2024, 6, 0],
    [0, 6, 15],
  ])('has no date for %d-%d-%d', (year, month, day) => {
    expect(plainDateOf(year, month, day)).toBeUndefined();
  });

  it('has no date while a part is missing', () => {
    expect(plainDateOf(undefined, 6, 15)).toBeUndefined();
    expect(plainDateOf(2024, undefined, 15)).toBeUndefined();
    expect(plainDateOf(2024, 6, undefined)).toBeUndefined();
  });
});

describe('nextWeekday', () => {
  const monday = Temporal.PlainDate.from('2024-01-08');

  it.each([
    [EDayOfWeek.Tuesday, '2024-01-09'],
    [EDayOfWeek.Friday, '2024-01-12'],
    [EDayOfWeek.Sunday, '2024-01-14'],
  ])('finds the weekday %d later in the week', (weekday, expected) => {
    expect(nextWeekday(monday, weekday).toString()).toBe(expected);
  });

  it('goes a week ahead for the weekday of today', () => {
    expect(nextWeekday(monday, EDayOfWeek.Monday).toString()).toBe('2024-01-15');
  });
});

describe('previousWeekday', () => {
  const wednesday = Temporal.PlainDate.from('2024-01-10');

  it.each([
    [EDayOfWeek.Monday, '2024-01-08'],
    [EDayOfWeek.Friday, '2024-01-05'],
  ])('finds the weekday %d earlier', (weekday, expected) => {
    expect(previousWeekday(wednesday, weekday).toString()).toBe(expected);
  });

  it('goes a week back for the weekday of today', () => {
    expect(previousWeekday(wednesday, EDayOfWeek.Wednesday).toString()).toBe('2024-01-03');
  });
});

describe('shifted', () => {
  const today = Temporal.ZonedDateTime.from('2024-06-15T14:00:00[UTC]');

  it.each([
    [30, EOffsetUnit.Second, '2024-06-15T14:00:30'],
    [90, EOffsetUnit.Minute, '2024-06-15T15:30:00'],
    [-4, EOffsetUnit.Hour, '2024-06-15T10:00:00'],
    [12, EOffsetUnit.Hour, '2024-06-16T02:00:00'],
    [5, EOffsetUnit.Day, '2024-06-20T14:00:00'],
    [-5, EOffsetUnit.Day, '2024-06-10T14:00:00'],
    [2, EOffsetUnit.Week, '2024-06-29T14:00:00'],
    [3, EOffsetUnit.Month, '2024-09-15T14:00:00'],
    [-1, EOffsetUnit.Month, '2024-05-15T14:00:00'],
    [1, EOffsetUnit.Year, '2025-06-15T14:00:00'],
  ])('moves the moment by %d %s', (amount, unit, expected) => {
    expect(shifted(today, amount, unit)?.toPlainDateTime().toString()).toBe(expected);
  });

  it('keeps the hour on the clock across a change of the clocks', () => {
    const beforeSpringForward = Temporal.ZonedDateTime.from('2024-03-30T12:00:00[Europe/Berlin]');

    expect(shifted(beforeSpringForward, 1, EOffsetUnit.Day)?.toPlainDateTime().toString()).toBe(
      '2024-03-31T12:00:00'
    );
    expect(shifted(beforeSpringForward, 24, EOffsetUnit.Hour)?.toPlainDateTime().toString()).toBe(
      '2024-03-31T13:00:00'
    );
  });

  it.each([
    [1.5, EOffsetUnit.Hour, '2024-06-15T15:30:00'],
    [-0.5, EOffsetUnit.Hour, '2024-06-15T13:30:00'],
    [2.5, EOffsetUnit.Minute, '2024-06-15T14:02:30'],
    [1.5, EOffsetUnit.Second, '2024-06-15T14:00:01.5'],
    [2.5, EOffsetUnit.Day, '2024-06-18T02:00:00'],
    [-1.25, EOffsetUnit.Day, '2024-06-14T08:00:00'],
    [0.5, EOffsetUnit.Week, '2024-06-19T02:00:00'],
  ])('moves the moment by %d %s, a part of the unit included', (amount, unit, expected) => {
    expect(shifted(today, amount, unit)?.toPlainDateTime().toString()).toBe(expected);
  });

  it.each([
    [1.5, EOffsetUnit.Month],
    [0.5, EOffsetUnit.Year],
  ])('has no moment %d %s away: a part of it has no length', (amount, unit) => {
    expect(shifted(today, amount, unit)).toBeUndefined();
  });

  it.each([
    [99999999999, EOffsetUnit.Year],
    [-99999999999, EOffsetUnit.Day],
    [99999999999, EOffsetUnit.Minute],
    [8000, EOffsetUnit.Year],
    [-3000, EOffsetUnit.Year],
  ])('has no date %d %s away, past the calendar', (amount, unit) => {
    expect(shifted(today, amount, unit)).toBeUndefined();
  });
});

describe('thisWeekday', () => {
  const monday = Temporal.PlainDate.from('2024-01-08');

  it('takes today for the weekday of today', () => {
    expect(thisWeekday(monday, EDayOfWeek.Monday).toString()).toBe('2024-01-08');
  });

  it('finds any other weekday later in the week', () => {
    expect(thisWeekday(monday, EDayOfWeek.Sunday).toString()).toBe('2024-01-14');
  });
});

describe('weekendOf', () => {
  it.each([
    ['2024-06-10', 0, '2024-06-15'],
    ['2024-06-14', 0, '2024-06-15'],
    ['2024-06-15', 0, '2024-06-15'],
    ['2024-06-16', 0, '2024-06-16'],
    ['2024-06-12', 1, '2024-06-22'],
    ['2024-06-16', 1, '2024-06-22'],
    ['2024-06-12', -1, '2024-06-08'],
    ['2024-06-16', -1, '2024-06-08'],
  ])('asked on %s, finds the weekend %d weeks ahead', (asked, weeksAhead, expected) => {
    expect(weekendOf(Temporal.PlainDate.from(asked), weeksAhead).toString()).toBe(expected);
  });
});

describe('boundaryDate', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it.each([
    [EPeriod.Day, '2024-06-15'],
    [EPeriod.Week, '2024-06-16'],
    [EPeriod.Month, '2024-06-30'],
    [EPeriod.Quarter, '2024-06-30'],
    [EPeriod.Year, '2024-12-31'],
  ])('ends the %s today falls in on its last day', (period, expected) => {
    expect(boundaryDate(EEdge.End, period, 0, today).toString()).toBe(expected);
  });

  it.each([
    [EPeriod.Week, '2024-06-17'],
    [EPeriod.Month, '2024-07-01'],
    [EPeriod.Quarter, '2024-07-01'],
    [EPeriod.Year, '2025-01-01'],
  ])('takes the start of the next %s once this one has begun', (period, expected) => {
    expect(boundaryDate(EEdge.Start, period, 0, today).toString()).toBe(expected);
  });

  it('takes today for a start that falls on today', () => {
    const newYear = Temporal.PlainDate.from('2024-01-01');

    expect(boundaryDate(EEdge.Start, EPeriod.Day, 0, today).toString()).toBe('2024-06-15');
    expect(boundaryDate(EEdge.Start, EPeriod.Week, 0, newYear).toString()).toBe('2024-01-01');
    expect(boundaryDate(EEdge.Start, EPeriod.Month, 0, newYear).toString()).toBe('2024-01-01');
    expect(boundaryDate(EEdge.Start, EPeriod.Year, 0, newYear).toString()).toBe('2024-01-01');
  });

  it.each([
    [EEdge.Start, EPeriod.Month, 1, '2024-07-01'],
    [EEdge.End, EPeriod.Month, 1, '2024-07-31'],
    [EEdge.Start, EPeriod.Month, -1, '2024-05-01'],
    [EEdge.End, EPeriod.Month, -1, '2024-05-31'],
    [EEdge.Start, EPeriod.Quarter, 1, '2024-07-01'],
    [EEdge.End, EPeriod.Quarter, 1, '2024-09-30'],
    [EEdge.End, EPeriod.Quarter, -1, '2024-03-31'],
    [EEdge.Start, EPeriod.Week, -1, '2024-06-03'],
    [EEdge.End, EPeriod.Week, 1, '2024-06-23'],
    [EEdge.Start, EPeriod.Year, 1, '2025-01-01'],
    [EEdge.End, EPeriod.Year, -1, '2023-12-31'],
    [EEdge.End, EPeriod.Day, 1, '2024-06-16'],
  ])('finds the %s of the %s %d away', (edge, period, periodsAhead, expected) => {
    expect(boundaryDate(edge, period, periodsAhead, today).toString()).toBe(expected);
  });

  it('ends a month on its own last day, not on the day of the month before', () => {
    const endOfJanuary = Temporal.PlainDate.from('2024-01-31');

    expect(boundaryDate(EEdge.End, EPeriod.Month, 1, endOfJanuary).toString()).toBe('2024-02-29');
  });
});

describe('firstMonthOfQuarter', () => {
  it.each([
    [1, 1],
    [2, 4],
    [3, 7],
    [4, 10],
  ])('starts Q%d in month %d', (quarter, month) => {
    expect(firstMonthOfQuarter(quarter)).toBe(month);
  });
});
