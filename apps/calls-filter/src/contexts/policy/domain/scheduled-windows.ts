import type { ICalendarRule, IScheduledAction } from './policy';
import type { TWindowSet } from './window-set';
import { intersectWindows, normalizeWindows, subtractWindows } from './window-set';

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
