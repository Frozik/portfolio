import type { TCalendarSource } from '../../calendars/domain/calendar-source';
import type { TAction } from './action';
import type { IPlaceRule } from './place-rule';
import type { TRepeatPass } from './repeat-pass';
import { REPEAT_OFF } from './repeat-pass';
import type { ISchedule } from './schedule';

export interface IEventFilter {
  readonly skipDeclined: boolean;
  readonly includeAllDay: boolean;
  readonly minutesBefore: number;
  readonly minutesAfter: number;
}

export interface ICalendarRule {
  readonly source: TCalendarSource;
  readonly mode: 'except-events' | 'only-during-events';
  readonly filter: IEventFilter;
}

/** When a group is in force: a schedule (all the time when absent) narrowed by calendars and places. */
export interface IConditions {
  readonly schedule: ISchedule | null;
  readonly calendars: readonly ICalendarRule[];
  readonly places: readonly IPlaceRule[];
}

/** Conditions that narrow nothing — no schedule, calendar or place — are no conditions. */
function narrowsNothing(conditions: IConditions): boolean {
  return (
    conditions.schedule === null &&
    conditions.calendars.length === 0 &&
    conditions.places.length === 0
  );
}

export interface IPolicy {
  /** What the group does with a call it takes, while it is in force. */
  readonly action: TAction;
  /** When the group is in force; `null`: always. */
  readonly conditions: IConditions | null;
  /** The group's own «a repeat rings»; the filter-wide switch adds to it. */
  readonly repeatPass: TRepeatPass;
  /** How long a second call from the same number counts as a repeat. */
  readonly repeatWindowMinutes: number;
}

export const DEFAULT_REPEAT_WINDOW_MINUTES = 5;

export const ALWAYS_PASS: IPolicy = {
  action: 'pass',
  conditions: null,
  repeatPass: REPEAT_OFF,
  repeatWindowMinutes: DEFAULT_REPEAT_WINDOW_MINUTES,
};

export const ALWAYS_BLOCK: IPolicy = {
  action: 'block',
  conditions: null,
  repeatPass: REPEAT_OFF,
  repeatWindowMinutes: DEFAULT_REPEAT_WINDOW_MINUTES,
};

/** The group's conditions replaced: ones that narrow nothing leave it in force always. */
export function withConditions(policy: IPolicy, conditions: IConditions | null): IPolicy {
  return {
    ...policy,
    conditions: conditions === null || narrowsNothing(conditions) ? null : conditions,
  };
}
