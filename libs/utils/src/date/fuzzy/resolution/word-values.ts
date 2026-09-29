import { Temporal } from 'temporal-polyfill';

import { assertNever } from '../../../assert/assertNever';
import type { Token, TokenOf } from '../lexer/token';
import { EDateKeyword, EDirection, EEdge, EPeriod, ETokenKind } from '../lexer/token';
import type { SlotValues } from '../slot';
import { ESlot } from '../slot';
import {
  boundaryDate,
  firstMonthOfQuarter,
  nextWeekday,
  previousWeekday,
  thisWeekday,
  weekendOf,
} from './calendar';

const NOTHING: SlotValues = {};
const LAST_MOMENT_OF_DAY = Temporal.PlainTime.from('23:59:59.999');

export function dateValues(date: Temporal.PlainDate): SlotValues {
  return { [ESlot.Year]: date.year, [ESlot.Month]: date.month, [ESlot.Day]: date.day };
}

export function timeValues(time: Temporal.PlainTime): SlotValues {
  return {
    [ESlot.Hour]: time.hour,
    [ESlot.Minute]: time.minute,
    [ESlot.Second]: time.second,
    [ESlot.Millisecond]: time.millisecond,
  };
}

function keywordValues(keyword: EDateKeyword, now: Temporal.ZonedDateTime): SlotValues {
  const today = now.toPlainDate();

  switch (keyword) {
    case EDateKeyword.Today:
      return dateValues(today);
    case EDateKeyword.Tomorrow:
      return dateValues(today.add({ days: 1 }));
    case EDateKeyword.Yesterday:
      return dateValues(today.subtract({ days: 1 }));
    case EDateKeyword.Now:
      return { ...dateValues(today), ...timeValues(now.toPlainTime()) };
    default:
      return assertNever(keyword);
  }
}

function relativeWeekday(
  { direction, weekday }: TokenOf<ETokenKind.RelativeWeekday>,
  today: Temporal.PlainDate
): Temporal.PlainDate {
  switch (direction) {
    case EDirection.Last:
      return previousWeekday(today, weekday);
    case EDirection.This:
      return thisWeekday(today, weekday);
    case EDirection.Next:
      return nextWeekday(today, weekday);
    default:
      return assertNever(direction);
  }
}

/** The end of a day is its last moment; the end of a longer period is its last day. */
function boundaryValues(
  { edge, period, periodsAhead }: TokenOf<ETokenKind.Boundary>,
  today: Temporal.PlainDate
): SlotValues {
  const date = dateValues(boundaryDate(edge, period, periodsAhead, today));
  const isEndOfDay = edge === EEdge.End && period === EPeriod.Day;

  return isEndOfDay ? { ...date, ...timeValues(LAST_MOMENT_OF_DAY) } : date;
}

/** The values a token gives to the slots `slotsStatedBy` says it settles. */
export function valuesStatedBy(token: Token, now: Temporal.ZonedDateTime): SlotValues {
  const today = now.toPlainDate();

  switch (token.kind) {
    case ETokenKind.DateKeyword:
      return keywordValues(token.keyword, now);
    case ETokenKind.WeekdayName:
      return dateValues(nextWeekday(today, token.weekday));
    case ETokenKind.RelativeWeekday:
      return dateValues(relativeWeekday(token, today));
    case ETokenKind.Boundary:
      return boundaryValues(token, today);
    case ETokenKind.Weekend:
      return dateValues(weekendOf(today, token.weeksAhead));
    case ETokenKind.Quarter:
      return { [ESlot.Month]: firstMonthOfQuarter(token.quarter), [ESlot.Day]: 1 };
    case ETokenKind.MonthName:
      return { [ESlot.Month]: token.month };
    case ETokenKind.Ordinal:
      return { [ESlot.Day]: token.day };
    case ETokenKind.Year:
      return { [ESlot.Year]: token.year };
    case ETokenKind.TimeKeyword:
      return {
        [ESlot.Hour]: token.hour,
        [ESlot.Minute]: 0,
        [ESlot.Second]: 0,
        [ESlot.Millisecond]: 0,
      };
    case ETokenKind.ClockTime:
      return {
        [ESlot.Hour]: token.hour,
        [ESlot.Minute]: token.minute,
        [ESlot.Second]: token.second,
        [ESlot.Millisecond]: token.millisecond,
      };
    case ETokenKind.Number:
    case ETokenKind.Offset:
    case ETokenKind.Meridiem:
    case ETokenKind.DayPart:
    case ETokenKind.ZoneOffset:
    case ETokenKind.Direction:
    case ETokenKind.Unit:
    case ETokenKind.Filler:
    case ETokenKind.Unknown:
      return NOTHING;
    default:
      return assertNever(token);
  }
}
