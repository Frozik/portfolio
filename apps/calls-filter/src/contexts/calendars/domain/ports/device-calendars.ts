import type { Temporal } from 'temporal-polyfill';

import type { ICalendarEvent } from '../calendar-event';

/** A calendar of an account on the phone, named the way another phone finds it again. */
export interface IDeviceCalendar {
  readonly id: string;
  readonly accountType: string;
  readonly accountName: string;
  readonly calendarName: string;
  readonly color: string | null;
  /** Google's public holiday calendars are owned by `…#holiday@group.v.calendar.google.com`. */
  readonly isHolidayCalendar: boolean;
}

/** The phone's calendar provider: local, synced by Android, readable offline. */
export interface IDeviceCalendars {
  calendars(): Promise<readonly IDeviceCalendar[]>;
  events(
    calendarId: string,
    from: Temporal.Instant,
    to: Temporal.Instant
  ): Promise<readonly ICalendarEvent[]>;
}
