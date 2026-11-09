import type { Temporal } from 'temporal-polyfill';

import type { ISchedule } from './schedule';

/** The days a schedule's recurrence picks, between two dates inclusive: the library sits behind it. */
export interface IRecurrenceExpander {
  occurrences(
    schedule: ISchedule,
    from: Temporal.PlainDate,
    to: Temporal.PlainDate
  ): readonly Temporal.PlainDate[];
}
