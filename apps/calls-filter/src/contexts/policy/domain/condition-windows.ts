import type { ICalendarRule, IConditions } from './policy';
import type { TWindowSet } from './window-set';
import { intersectWindows, normalizeWindows, subtractWindows } from './window-set';

/** When the conditions allow by the clock: the schedule (all time when there is none) narrowed by the calendars. */
export function conditionWindows(
  conditions: IConditions,
  scheduleWindows: TWindowSet,
  eventsOf: (rule: ICalendarRule) => TWindowSet
): TWindowSet {
  const excepted = conditions.calendars
    .filter(rule => rule.mode === 'except-events')
    .reduce((windows, rule) => subtractWindows(windows, eventsOf(rule)), scheduleWindows);
  const only = conditions.calendars.filter(rule => rule.mode === 'only-during-events');
  if (only.length === 0) {
    return excepted;
  }
  return intersectWindows(excepted, normalizeWindows(only.flatMap(rule => eventsOf(rule))));
}
