import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { assertNever } from '../../../assert/assertNever';
import { getEndOfMonth, getStartOfWeek } from '../../boundaries';
import type { EDayOfWeek } from '../../constants';
import {
  DAYS_IN_WEEK,
  HOURS_PER_DAY,
  MINUTES_PER_DAY,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  SECONDS_PER_DAY,
} from '../../constants';
import { EEdge, EOffsetUnit, EPeriod } from '../lexer/token';
import { MONTHS_IN_YEAR, isWithin } from '../limits';

const MONTHS_IN_QUARTER = 3;
const FIRST_YEAR = 1;
const LAST_YEAR = 9999;
const MOST_WEEKS_IN_YEAR = 53;
const MOST_DAYS_IN_YEAR = 366;
const SATURDAY_OF_WEEK = 5;

const LONGEST_SHIFT: Readonly<Record<EOffsetUnit, number>> = {
  [EOffsetUnit.Second]: LAST_YEAR * MOST_DAYS_IN_YEAR * SECONDS_PER_DAY,
  [EOffsetUnit.Minute]: LAST_YEAR * MOST_DAYS_IN_YEAR * MINUTES_PER_DAY,
  [EOffsetUnit.Hour]: LAST_YEAR * MOST_DAYS_IN_YEAR * HOURS_PER_DAY,
  [EOffsetUnit.Day]: LAST_YEAR * MOST_DAYS_IN_YEAR,
  [EOffsetUnit.Week]: LAST_YEAR * MOST_WEEKS_IN_YEAR,
  [EOffsetUnit.Month]: LAST_YEAR * MONTHS_IN_YEAR,
  [EOffsetUnit.Year]: LAST_YEAR,
};

const FIXED_LENGTHS: ReadonlyMap<EOffsetUnit, number> = new Map([
  [EOffsetUnit.Second, MS_PER_SECOND],
  [EOffsetUnit.Minute, MS_PER_MINUTE],
  [EOffsetUnit.Hour, MS_PER_HOUR],
  [EOffsetUnit.Day, MS_PER_DAY],
  [EOffsetUnit.Week, MS_PER_DAY * DAYS_IN_WEEK],
]);

const LENGTHS: Readonly<Record<EPeriod, Temporal.DurationLike>> = {
  [EPeriod.Day]: { days: 1 },
  [EPeriod.Week]: { weeks: 1 },
  [EPeriod.Month]: { months: 1 },
  [EPeriod.Quarter]: { months: MONTHS_IN_QUARTER },
  [EPeriod.Year]: { years: 1 },
};

/** `undefined` for a date the calendar does not have — 30 February, month 13 — or a missing part. */
export function plainDateOf(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined
): Temporal.PlainDate | undefined {
  if (isNil(year) || isNil(month) || isNil(day)) {
    return undefined;
  }
  if (!isWithin(year, FIRST_YEAR, LAST_YEAR) || !isWithin(month, 1, MONTHS_IN_YEAR)) {
    return undefined;
  }
  const lastDay = getEndOfMonth(new Temporal.PlainYearMonth(year, month));

  return isWithin(day, 1, lastDay.day) ? lastDay.with({ day }) : undefined;
}

export function firstMonthOfQuarter(quarter: number): number {
  return (quarter - 1) * MONTHS_IN_QUARTER + 1;
}

function daysBetweenWeekdays(from: number, to: number): number {
  return (to - from + DAYS_IN_WEEK) % DAYS_IN_WEEK;
}

/** The weekday of today counts: asked on a Saturday, "this sat" is today. */
export function thisWeekday(today: Temporal.PlainDate, weekday: EDayOfWeek): Temporal.PlainDate {
  return today.add({ days: daysBetweenWeekdays(today.dayOfWeek, weekday) });
}

/** The weekday of today does not count: asked on a Saturday, "sat" is a week ahead. */
export function nextWeekday(today: Temporal.PlainDate, weekday: EDayOfWeek): Temporal.PlainDate {
  return thisWeekday(today.add({ days: 1 }), weekday);
}

export function previousWeekday(
  today: Temporal.PlainDate,
  weekday: EDayOfWeek
): Temporal.PlainDate {
  const yesterday = today.subtract({ days: 1 });

  return yesterday.subtract({ days: daysBetweenWeekdays(weekday, yesterday.dayOfWeek) });
}

function wholeDuration(amount: number, unit: EOffsetUnit): Temporal.DurationLike {
  switch (unit) {
    case EOffsetUnit.Second:
      return { seconds: amount };
    case EOffsetUnit.Minute:
      return { minutes: amount };
    case EOffsetUnit.Hour:
      return { hours: amount };
    case EOffsetUnit.Day:
      return { days: amount };
    case EOffsetUnit.Week:
      return { weeks: amount };
    case EOffsetUnit.Month:
      return { months: amount };
    case EOffsetUnit.Year:
      return { years: amount };
    default:
      return assertNever(unit);
  }
}

/**
 * "2.5d" is two days on the calendar and twelve hours on the clock. A part of a month or
 * of a year has no length of its own, so there is no duration for it.
 */
function durationOf(amount: number, unit: EOffsetUnit): Temporal.DurationLike | undefined {
  const whole = Math.trunc(amount);
  const length = FIXED_LENGTHS.get(unit);
  if (whole === amount) {
    return wholeDuration(whole, unit);
  }
  return isNil(length)
    ? undefined
    : { ...wholeDuration(whole, unit), milliseconds: Math.round((amount - whole) * length) };
}

/** `undefined` for a shift that leaves the calendar: checked first, because `Temporal` throws on one. */
export function shifted(
  moment: Temporal.ZonedDateTime,
  amount: number,
  unit: EOffsetUnit
): Temporal.ZonedDateTime | undefined {
  const duration = durationOf(amount, unit);
  if (isNil(duration) || Math.abs(amount) > LONGEST_SHIFT[unit]) {
    return undefined;
  }
  const result = moment.add(duration);

  return isWithin(result.year, FIRST_YEAR, LAST_YEAR) ? result : undefined;
}

/** On the Sunday of the weekend today falls in, the weekend is today. */
export function weekendOf(today: Temporal.PlainDate, weeksAhead: number): Temporal.PlainDate {
  const saturday = getStartOfWeek(today).add({ weeks: weeksAhead }).add({ days: SATURDAY_OF_WEEK });
  const hasBegun = weeksAhead === 0 && Temporal.PlainDate.compare(saturday, today) < 0;

  return hasBegun ? today : saturday;
}

function startOfPeriod(period: EPeriod, date: Temporal.PlainDate): Temporal.PlainDate {
  switch (period) {
    case EPeriod.Day:
      return date;
    case EPeriod.Week:
      return getStartOfWeek(date);
    case EPeriod.Month:
      return date.with({ day: 1 });
    case EPeriod.Quarter:
      return date.with({
        day: 1,
        month: firstMonthOfQuarter(Math.ceil(date.month / MONTHS_IN_QUARTER)),
      });
    case EPeriod.Year:
      return date.with({ day: 1, month: 1 });
    default:
      return assertNever(period);
  }
}

function lengthsAhead(period: EPeriod, periods: number): Temporal.Duration {
  return Temporal.Duration.from(LENGTHS[period]).with(
    Object.fromEntries(
      Object.entries(LENGTHS[period]).map(([unit, size]) => [unit, size * periods])
    )
  );
}

/**
 * The first or the last day of a period. The start of the period today falls in may have
 * passed already, and then the next one is meant: "bom" on the 15th is the 1st of next month.
 */
export function boundaryDate(
  edge: EEdge,
  period: EPeriod,
  periodsAhead: number,
  today: Temporal.PlainDate
): Temporal.PlainDate {
  const start = startOfPeriod(period, today).add(lengthsAhead(period, periodsAhead));
  const next = start.add(LENGTHS[period]);
  const hasPassed = periodsAhead === 0 && Temporal.PlainDate.compare(start, today) < 0;

  switch (edge) {
    case EEdge.Start:
      return hasPassed ? next : start;
    case EEdge.End:
      return next.subtract({ days: 1 });
    default:
      return assertNever(edge);
  }
}
