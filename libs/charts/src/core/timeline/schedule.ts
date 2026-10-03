import type { EDayOfWeek } from '@frozik/utils/date/constants';

/** Whether an entry opens the time it names or closes it; closed always wins (sessions §3). */
export type TScheduleEffect = 'open' | 'closed';

/**
 * A moment (`'2026-05-11T00:00'`) or a time of day (`'09:00'`), read in the
 * zone given with it, else in the schedule's, else in the axis's.
 */
export type TBoundary = string | { readonly at: string; readonly timeZone: string };

/** One stretch of time, from a moment to a moment: a holiday, a single extra session. */
export interface IOnceEntry {
  readonly kind: 'once';
  readonly effect: TScheduleEffect;
  readonly from: TBoundary;
  readonly to: TBoundary;
}

/**
 * A stretch of every named day of the week, from a time of day to a time of
 * day; one ending before it starts runs over midnight. The day is counted in
 * the zone of `from`.
 */
export interface IWeeklyEntry {
  readonly kind: 'weekly';
  readonly effect: TScheduleEffect;
  readonly days: readonly EDayOfWeek[];
  readonly from: TBoundary;
  readonly to: TBoundary;
}

export type TScheduleEntry = IOnceEntry | IWeeklyEntry;

/**
 * When the axis is open. With any `open` entry the rest of time is closed;
 * without one it is open and the `closed` entries take time out of it.
 */
export interface ISchedule {
  readonly timeZone?: string;
  readonly entries: readonly TScheduleEntry[];
}
