import { isNil, range } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

import type { SlotValues } from '../slot';
import { DATE_SLOTS, ESlot } from '../slot';
import { plainDateOf } from './calendar';

export interface IDateShape {
  /** An input that has exactly these parts of the date. */
  readonly example: string;
  readonly known: readonly ESlot[];
  /** Every date the known parts may mean, earliest first, from the period today falls in. */
  readonly occurrences: (
    values: SlotValues,
    today: Temporal.PlainDate
  ) => readonly Temporal.PlainDate[];
}

/** 29 February falls on the same weekday once in 28 years; Friday the 13th is never further than 14 months away. */
const YEARS_AHEAD = 28;
const MONTHS_AHEAD = 14;
const FIRST_DAY = 1;

function existing(dates: readonly (Temporal.PlainDate | undefined)[]): Temporal.PlainDate[] {
  return dates.flatMap(date => (isNil(date) ? [] : [date]));
}

function everyYear(
  today: Temporal.PlainDate,
  dateIn: (year: number) => Temporal.PlainDate | undefined
): readonly Temporal.PlainDate[] {
  return existing(range(YEARS_AHEAD + 1).map(years => dateIn(today.year + years)));
}

function everyMonth(
  today: Temporal.PlainDate,
  dateIn: (year: number, month: number) => Temporal.PlainDate | undefined
): readonly Temporal.PlainDate[] {
  const thisMonth = today.toPlainYearMonth();

  return existing(
    range(MONTHS_AHEAD + 1).map(months => {
      const { year, month } = thisMonth.add({ months });
      return dateIn(year, month);
    })
  );
}

/** A date is read by which of its parts are known; the parts left untold make it recur. */
export const DATE_SHAPES: readonly IDateShape[] = [
  {
    example: '15 jan 2025',
    known: [ESlot.Year, ESlot.Month, ESlot.Day],
    occurrences: ({ year, month, day }) => existing([plainDateOf(year, month, day)]),
  },
  {
    example: 'jan 2025',
    known: [ESlot.Year, ESlot.Month],
    occurrences: ({ year, month }) => existing([plainDateOf(year, month, FIRST_DAY)]),
  },
  {
    example: '15 jan',
    known: [ESlot.Month, ESlot.Day],
    occurrences: ({ month, day }, today) => everyYear(today, year => plainDateOf(year, month, day)),
  },
  {
    example: 'jan',
    known: [ESlot.Month],
    occurrences: ({ month }, today) =>
      everyYear(today, year => plainDateOf(year, month, FIRST_DAY)),
  },
  {
    example: '15th',
    known: [ESlot.Day],
    occurrences: ({ day }, today) =>
      everyMonth(today, (year, month) => plainDateOf(year, month, day)),
  },
  {
    example: '13:00',
    known: [],
    occurrences: (_values, today) => [today, today.add({ days: 1 })],
  },
];

export function dateShapeOf(values: SlotValues): IDateShape | undefined {
  const known = DATE_SLOTS.filter(slot => !isNil(values[slot]));

  return DATE_SHAPES.find(
    shape => shape.known.length === known.length && shape.known.every(slot => known.includes(slot))
  );
}
