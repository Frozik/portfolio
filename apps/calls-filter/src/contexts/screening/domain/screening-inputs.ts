import type { Temporal } from 'temporal-polyfill';

import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { ICalendarRule } from '../../policy/domain/policy';
import type { ISchedule } from '../../policy/domain/schedule';
import type { TWindowSet } from '../../policy/domain/window-set';

/**
 * What turns a group book into windows: the recurrence expansion, the holidays by country
 * and the calendar events, all already on the phone. Compiling the ruleset and deciding in
 * the app read the same inputs, so both see the same windows.
 */
export interface IScreeningInputs {
  /** The phone's zone now: schedules on another zone's clock are read on this one. */
  readonly zone: string;
  readonly horizonStart: Temporal.PlainDate;
  readonly horizonEnd: Temporal.PlainDate;
  readonly occurrencesOf: (schedule: ISchedule) => readonly Temporal.PlainDate[];
  readonly holidaysByCountry: ReadonlyMap<TCountryCode, readonly Temporal.PlainDate[]>;
  /** Events of a calendar rule, its filter applied: what the service bakes in as a fallback. */
  readonly eventsOf: (rule: ICalendarRule) => TWindowSet;
}
