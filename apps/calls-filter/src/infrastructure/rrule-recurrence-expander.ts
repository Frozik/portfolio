import { assertNever } from '@frozik/utils/assert/assertNever';
import { RRuleTemporal } from 'rrule-temporal';
import { Temporal } from 'temporal-polyfill';

import type { IRecurrenceExpander } from '../contexts/policy/domain/recurrence-expander';
import type { IRecurrence, ISchedule, TWeekday } from '../contexts/policy/domain/schedule';

const RRULE_WEEKDAYS: Readonly<Record<TWeekday, string>> = {
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
  7: 'SU',
};

/** Occurrences are dates: the rule runs at midnight UTC, which never moves under a clock change. */
const RULE_ZONE = 'UTC';

function frequency(recurrence: IRecurrence): 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' {
  switch (recurrence.frequency) {
    case 'daily':
      return 'DAILY';
    case 'weekly':
      return 'WEEKLY';
    case 'monthly':
      return 'MONTHLY';
    case 'yearly':
      return 'YEARLY';
    default:
      return assertNever(recurrence.frequency);
  }
}

function midnight(date: Temporal.PlainDate): Temporal.ZonedDateTime {
  return date.toZonedDateTime({ timeZone: RULE_ZONE });
}

function ruleOf(schedule: ISchedule, recurrence: IRecurrence) {
  const { monthly, end } = recurrence;
  return new RRuleTemporal({
    freq: frequency(recurrence),
    interval: recurrence.interval,
    dtstart: midnight(schedule.start),
    byDay:
      monthly?.kind === 'nth-weekday'
        ? [`${monthly.nth}${RRULE_WEEKDAYS[monthly.weekday]}`]
        : recurrence.weekdays.map(weekday => RRULE_WEEKDAYS[weekday]),
    byMonthDay: monthly?.kind === 'day-of-month' ? [monthly.day] : undefined,
    count: end.kind === 'count' ? end.count : undefined,
    until: end.kind === 'until' ? midnight(end.date) : undefined,
    temporal: Temporal,
  });
}

/** Google Calendar's repeats over RFC 5545, through `rrule-temporal`. */
export const RRULE_RECURRENCE_EXPANDER: IRecurrenceExpander = {
  occurrences(schedule, from, to) {
    if (schedule.repeat === null) {
      const isInside =
        Temporal.PlainDate.compare(schedule.start, from) >= 0 &&
        Temporal.PlainDate.compare(schedule.start, to) <= 0;
      return isInside ? [schedule.start] : [];
    }
    const last = midnight(to);
    const first = midnight(from);
    return ruleOf(schedule, schedule.repeat)
      .all(occurrence => Temporal.ZonedDateTime.compare(occurrence, last) <= 0)
      .filter(occurrence => Temporal.ZonedDateTime.compare(occurrence, first) >= 0)
      .map(occurrence => occurrence.toPlainDate());
  },
};
