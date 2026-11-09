import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { ICalendarRule, IScheduledAction } from './policy';
import type { ISchedule } from './schedule';
import { timeWindow } from './schedule-windows';
import type { TWindowSet } from './window-set';
import { intersectWindows, normalizeWindows, subtractWindows } from './window-set';

/** The days that are holidays where the phone is now, as whole-day windows and as dates. */
export interface IHolidays {
  readonly dates: readonly Temporal.PlainDate[];
}

/** The base windows of a schedule moved by its holiday rule: also on holidays, or not on them. */
export function withHolidays(
  schedule: ISchedule,
  base: TWindowSet,
  holidays: IHolidays
): TWindowSet {
  switch (schedule.holidays) {
    case null:
      return base;
    case 'not-on-holidays':
      return subtractWindows(base, holidayDays(holidays));
    case 'also-on-holidays':
      return normalizeWindows([
        ...base,
        ...holidays.dates.flatMap(date => schedule.times.map(time => timeWindow(date, time))),
      ]);
    default:
      return assertNever(schedule.holidays);
  }
}

function holidayDays(holidays: IHolidays): TWindowSet {
  return normalizeWindows(holidays.dates.map(date => timeWindow(date, { kind: 'all-day' })));
}

/** The windows of the scheduled action: the schedule (all time when there is none) narrowed by its calendars. */
export function scheduledWindows(
  scheduled: IScheduledAction,
  scheduleWindows: TWindowSet,
  eventsOf: (rule: ICalendarRule) => TWindowSet
): TWindowSet {
  const excepted = scheduled.calendars
    .filter(rule => rule.mode === 'except-events')
    .reduce((windows, rule) => subtractWindows(windows, eventsOf(rule)), scheduleWindows);
  const only = scheduled.calendars.filter(rule => rule.mode === 'only-during-events');
  if (only.length === 0) {
    return excepted;
  }
  return intersectWindows(excepted, normalizeWindows(only.flatMap(rule => eventsOf(rule))));
}
