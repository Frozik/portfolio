import type { Temporal } from 'temporal-polyfill';

/** An event as a calendar gives it: device provider or an iCal feed, already expanded. */
export interface ICalendarEvent {
  readonly start: Temporal.Instant;
  readonly end: Temporal.Instant;
  readonly allDay: boolean;
  /** For an all-day event the dates it covers, end exclusive: the wall-clock days, wherever the phone is. */
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
  readonly busy: boolean;
  readonly declined: boolean;
  readonly title: string;
}
