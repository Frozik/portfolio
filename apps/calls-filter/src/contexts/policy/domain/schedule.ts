import type { Temporal } from 'temporal-polyfill';

export type TWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TScheduleTime =
  | { readonly kind: 'all-day' }
  | { readonly kind: 'range'; readonly from: Temporal.PlainTime; readonly to: Temporal.PlainTime };

type TMonthlyRule =
  | { readonly kind: 'day-of-month'; readonly day: number }
  | { readonly kind: 'nth-weekday'; readonly nth: 1 | 2 | 3 | 4 | -1; readonly weekday: TWeekday };

type TRecurrenceEnd =
  | { readonly kind: 'never' }
  | { readonly kind: 'until'; readonly date: Temporal.PlainDate }
  | { readonly kind: 'count'; readonly count: number };

export interface IRecurrence {
  readonly frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  readonly interval: number;
  readonly weekdays: readonly TWeekday[];
  readonly monthly: TMonthlyRule | null;
  readonly end: TRecurrenceEnd;
}

/**
 * Whose clock the times are on. As in Google Calendar a schedule keeps its zone — work at 9–18
 * in Amsterdam is 10–19 in Helsinki; «here» follows the phone instead, for night silence and the like.
 */
export type TScheduleZone =
  | { readonly kind: 'here' }
  | { readonly kind: 'fixed'; readonly zone: string };

/**
 * When a group is in force, as Google Calendar repeats an event: one or more times
 * of day on the days a recurrence picks, on the clock of its zone.
 */
export interface ISchedule {
  readonly zone: TScheduleZone;
  readonly start: Temporal.PlainDate;
  readonly times: readonly TScheduleTime[];
  readonly repeat: IRecurrence | null;
  readonly exceptDates: readonly Temporal.PlainDate[];
}
