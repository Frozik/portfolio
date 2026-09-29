import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { tokenize } from '../lexer/tokenize';
import { scoreCandidates } from '../scoring/score-candidates';
import type { SlotValues } from '../slot';
import { ESlot } from '../slot';
import { assignSlots } from './assign-slots';
import { DATE_SHAPES, dateShapeOf } from './date-shapes';
import { valuesStatedBy } from './word-values';

const today = Temporal.PlainDate.from('2024-06-15');

function occurrences(values: SlotValues, from = today): readonly string[] | undefined {
  return dateShapeOf(values)
    ?.occurrences(values, from)
    .map(date => date.toString());
}

describe('date shapes', () => {
  it('reads a full date as that one day', () => {
    expect(occurrences({ [ESlot.Year]: 2025, [ESlot.Month]: 1, [ESlot.Day]: 15 })).toEqual([
      '2025-01-15',
    ]);
  });

  it('reads a month of a year as its first day', () => {
    expect(occurrences({ [ESlot.Year]: 2027, [ESlot.Month]: 1 })).toEqual(['2027-01-01']);
  });

  it('has no day for a date the calendar lacks', () => {
    expect(occurrences({ [ESlot.Year]: 2025, [ESlot.Month]: 6, [ESlot.Day]: 31 })).toEqual([]);
  });

  it('repeats a day of a month every year, this year first', () => {
    expect(occurrences({ [ESlot.Month]: 1, [ESlot.Day]: 15 })?.slice(0, 3)).toEqual([
      '2024-01-15',
      '2025-01-15',
      '2026-01-15',
    ]);
  });

  it('repeats a month every year as its first day', () => {
    expect(occurrences({ [ESlot.Month]: 12 })?.slice(0, 2)).toEqual(['2024-12-01', '2025-12-01']);
  });

  it('repeats a day every month, this month first', () => {
    expect(occurrences({ [ESlot.Day]: 10 })?.slice(0, 3)).toEqual([
      '2024-06-10',
      '2024-07-10',
      '2024-08-10',
    ]);
  });

  it('carries a day of the month over the end of the year', () => {
    const december = Temporal.PlainDate.from('2024-12-20');

    expect(occurrences({ [ESlot.Day]: 5 }, december)?.slice(0, 2)).toEqual([
      '2024-12-05',
      '2025-01-05',
    ]);
  });

  it('skips the months that are too short for the day', () => {
    expect(occurrences({ [ESlot.Day]: 31 })?.slice(0, 3)).toEqual([
      '2024-07-31',
      '2024-08-31',
      '2024-10-31',
    ]);
  });

  it('skips the years without a leap day', () => {
    const afterLeapDay = Temporal.PlainDate.from('2025-03-01');

    expect(occurrences({ [ESlot.Month]: 2, [ESlot.Day]: 29 }, afterLeapDay)?.slice(0, 2)).toEqual([
      '2028-02-29',
      '2032-02-29',
    ]);
  });

  it('looks far enough ahead to meet every weekday', () => {
    const weekdays = (values: SlotValues) =>
      new Set(
        dateShapeOf(values)
          ?.occurrences(values, today)
          .map(date => date.dayOfWeek)
      );

    expect(weekdays({ [ESlot.Month]: 2, [ESlot.Day]: 29 }).size).toBe(7);
    expect(weekdays({ [ESlot.Day]: 13 }).size).toBe(7);
  });

  it('reads a time without a date as today or tomorrow', () => {
    expect(occurrences({ [ESlot.Hour]: 13 })).toEqual(['2024-06-15', '2024-06-16']);
  });

  it.each(DATE_SHAPES)('reads "$example" by the shape that gives it as an example', shape => {
    const tokens = tokenize(shape.example);
    const values = Object.assign(
      {},
      assignSlots(scoreCandidates(tokens)),
      ...tokens.map(token => valuesStatedBy(token, today.toZonedDateTime('UTC')))
    );

    expect(dateShapeOf(values)).toBe(shape);
  });

  it.each<[string, SlotValues]>([
    ['a year alone', { [ESlot.Year]: 2025 }],
    ['a day of a year without a month', { [ESlot.Year]: 2025, [ESlot.Day]: 15 }],
  ])('does not read %s as a date', (_name, values) => {
    expect(dateShapeOf(values)).toBeUndefined();
  });
});
