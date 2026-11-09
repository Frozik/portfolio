import type { Temporal } from 'temporal-polyfill';

import type { TCalendarSource } from '../../calendars/domain/calendar-source';
import type { TAction } from './action';
import type { IPlaceRule } from './place-rule';
import type { TRepeatPass } from './repeat-pass';
import { REPEAT_OFF } from './repeat-pass';
import type { ISchedule } from './schedule';

export interface IEventFilter {
  readonly busyOnly: boolean;
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

/** The action of the windows: a schedule (all the time when absent) narrowed by calendars and places. */
export interface IScheduledAction {
  readonly action: TAction;
  readonly schedule: ISchedule | null;
  readonly calendars: readonly ICalendarRule[];
  readonly places: readonly IPlaceRule[];
}

/** A scheduled action that narrows nothing — no schedule, calendar or place — is no scheduled action. */
export function narrowsNothing(scheduled: IScheduledAction): boolean {
  return (
    scheduled.schedule === null && scheduled.calendars.length === 0 && scheduled.places.length === 0
  );
}

export interface IPolicy {
  readonly otherwise: TAction;
  readonly scheduled: IScheduledAction | null;
  /** The group's own «a repeat rings»; the filter-wide switch adds to it. */
  readonly repeatPass: TRepeatPass;
  /** How long a second call from the same number counts as a repeat. */
  readonly repeatWindowMinutes: number;
}

export type TTemporaryUntil =
  | { readonly kind: 'instant'; readonly at: Temporal.Instant }
  | { readonly kind: 'first-pass'; readonly latest: Temporal.Instant }
  | { readonly kind: 'end-of-event'; readonly at: Temporal.Instant };

/** An action for a while, over the policy: «let couriers through for three days». */
export interface ITemporaryPolicy {
  readonly action: TAction;
  readonly until: TTemporaryUntil;
  readonly setAt: Temporal.Instant;
}

export const DEFAULT_REPEAT_WINDOW_MINUTES = 5;

export const ALWAYS_PASS: IPolicy = {
  otherwise: 'pass',
  scheduled: null,
  repeatPass: REPEAT_OFF,
  repeatWindowMinutes: DEFAULT_REPEAT_WINDOW_MINUTES,
};

export const ALWAYS_BLOCK: IPolicy = {
  otherwise: 'block',
  scheduled: null,
  repeatPass: REPEAT_OFF,
  repeatWindowMinutes: DEFAULT_REPEAT_WINDOW_MINUTES,
};
