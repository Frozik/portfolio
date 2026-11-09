import type { Temporal } from 'temporal-polyfill';

import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { ICalendarRule } from '../../policy/domain/policy';
import type { IRecurrenceExpander } from '../../policy/domain/recurrence-expander';
import type { ISchedule } from '../../policy/domain/schedule';
import type { TWindowSet } from '../../policy/domain/window-set';
import type { IScreeningInputs } from '../domain/screening-inputs';

/** How far ahead schedules are turned into windows: a background task renews it daily. */
const HORIZON_DAYS = 400;

/** What the calendars context supplies: holidays by country and the windows of a rule's events. */
export interface ICalendarInputs {
  readonly holidaysByCountry: ReadonlyMap<TCountryCode, readonly Temporal.PlainDate[]>;
  eventsOf(rule: ICalendarRule): TWindowSet;
}

export function screeningInputs(
  today: Temporal.PlainDate,
  zone: string,
  expander: IRecurrenceExpander,
  calendars: ICalendarInputs
): IScreeningInputs {
  const horizonStart = today.subtract({ days: 1 });
  const horizonEnd = today.add({ days: HORIZON_DAYS });
  const expanded = new Map<ISchedule, readonly Temporal.PlainDate[]>();
  return {
    zone,
    horizonStart,
    horizonEnd,
    occurrencesOf: schedule => {
      const known = expanded.get(schedule);
      if (known !== undefined) {
        return known;
      }
      const occurrences = expander.occurrences(schedule, horizonStart, horizonEnd);
      expanded.set(schedule, occurrences);
      return occurrences;
    },
    holidaysByCountry: calendars.holidaysByCountry,
    eventsOf: rule => calendars.eventsOf(rule),
  };
}
