import type { Temporal } from 'temporal-polyfill';

import { momentOnDate } from './boundary';
import type { ITimeInterval } from './intervals';
import { clippedTo, complementOf, differenceOf, unionOf } from './intervals';
import type { IScheduleRules, IWeeklyRule } from './schedule-rules';
import { onceIntervalsOf } from './schedule-rules';

/**
 * A weekly stretch is placed by the calendar date in the zone of its start,
 * and a week of the schedule's zone begins and ends at other moments in other
 * zones: the dates a day before and after the week are placed too, and
 * whatever falls outside the week is clipped away.
 */
const DATE_SLACK = 1;
const DAYS_PLACED = 7 + 2 * DATE_SLACK;

function placedOnDate(rule: IWeeklyRule, date: Temporal.PlainDate): ITimeInterval | undefined {
  if (!rule.days.has(date.dayOfWeek)) {
    return undefined;
  }
  const from = momentOnDate(rule.from, date);
  const to = momentOnDate(rule.to, date);
  return { from, to: to > from ? to : momentOnDate(rule.to, date.add({ days: 1 })) };
}

function weeklyIntervalsOf(
  rules: IScheduleRules,
  firstDate: Temporal.PlainDate,
  effect: 'open' | 'closed'
): readonly ITimeInterval[] {
  const placed: ITimeInterval[] = [];
  for (const rule of rules.weekly) {
    if (rule.effect !== effect) {
      continue;
    }
    for (let offset = 0; offset < DAYS_PLACED; offset += 1) {
      const interval = placedOnDate(rule, firstDate.add({ days: offset }));
      if (interval !== undefined) {
        placed.push(interval);
      }
    }
  }
  return placed;
}

/** The closed stretches of one week of the schedule's zone, `[weekStart, weekEnd)`, in order. */
export function cutsOfWeek(
  rules: IScheduleRules,
  weekStart: Temporal.ZonedDateTime,
  weekEnd: Temporal.ZonedDateTime
): readonly ITimeInterval[] {
  const week = { from: weekStart.epochNanoseconds, to: weekEnd.epochNanoseconds };
  const firstDate = weekStart.toPlainDate().subtract({ days: DATE_SLACK });
  const open = rules.openByDefault
    ? [week]
    : clippedTo(
        week,
        unionOf([...weeklyIntervalsOf(rules, firstDate, 'open'), ...onceIntervalsOf(rules, 'open')])
      );
  const closed = unionOf([
    ...weeklyIntervalsOf(rules, firstDate, 'closed'),
    ...onceIntervalsOf(rules, 'closed'),
  ]);
  return complementOf(week, differenceOf(open, closed));
}
