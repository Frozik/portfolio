import { EntityTypes, EventStatus, getCalendars, listEvents } from 'expo-calendar';
import { Temporal } from 'temporal-polyfill';

import type { ICalendarEvent } from '../contexts/calendars/domain/calendar-event';
import type { IDeviceCalendars } from '../contexts/calendars/domain/ports/device-calendars';

function legacyDate(instant: Temporal.Instant): Date {
  // oxlint-disable-next-line no-restricted-globals -- expo-calendar takes the event window only as Date
  return new Date(instant.epochMilliseconds);
}

function instantOf(value: string | Date): Temporal.Instant {
  return typeof value === 'string'
    ? Temporal.Instant.from(value)
    : Temporal.Instant.fromEpochMilliseconds(value.getTime());
}

export function expoDeviceCalendars(zone: () => string): IDeviceCalendars {
  return {
    async calendars() {
      const calendars = await getCalendars(EntityTypes.EVENT);
      return calendars.map(calendar => ({
        id: calendar.id,
        accountType: calendar.source.type ?? '',
        accountName: calendar.source.name,
        calendarName: calendar.title,
        color: calendar.color ?? null,
      }));
    },
    async events(calendarId, from, to) {
      const events = await listEvents([calendarId], legacyDate(from), legacyDate(to));
      return events
        .filter(event => event.status !== EventStatus.CANCELED)
        .map((event): ICalendarEvent => {
          const start = instantOf(event.startDate);
          const end = instantOf(event.endDate);
          return {
            start,
            end,
            allDay: event.allDay,
            startDate: event.allDay
              ? start.toZonedDateTimeISO('UTC').toPlainDate()
              : start.toZonedDateTimeISO(zone()).toPlainDate(),
            endDate: event.allDay
              ? end.toZonedDateTimeISO('UTC').toPlainDate()
              : end.toZonedDateTimeISO(zone()).toPlainDate(),
            declined: false,
            title: event.title,
          };
        });
    },
  };
}
