import { err, ok } from '@frozik/utils/result/result';
import ICAL from 'ical.js';
import { Temporal } from 'temporal-polyfill';

import type { ICalendarEvent } from '../contexts/calendars/domain/calendar-event';
import { looksLikeCalendar } from '../contexts/calendars/domain/ics-subscription';
import type { IIcsFeed } from '../contexts/calendars/domain/ports/ics-feed';

const NOT_MODIFIED = 304;
const SECONDS_TO_MILLISECONDS = 1000;
/** A runaway recurrence (every minute, for ever) stops here rather than freezing the phone. */
const MAX_OCCURRENCES_PER_EVENT = 5_000;

function dateOf(time: ICAL.Time): Temporal.PlainDate {
  return Temporal.PlainDate.from({ year: time.year, month: time.month, day: time.day });
}

function instantOf(time: ICAL.Time): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(time.toUnixTime() * SECONDS_TO_MILLISECONDS);
}

function eventOf(
  event: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
  busy: boolean
): ICalendarEvent {
  return {
    start: instantOf(start),
    end: instantOf(end),
    allDay: start.isDate,
    startDate: dateOf(start),
    endDate: dateOf(end),
    busy,
    declined: false,
    title: event.summary ?? '',
  };
}

export const ICS_HTTP_FEED: IIcsFeed = {
  async fetch(url, etag) {
    let response: Response;
    try {
      response = await fetch(url, { headers: etag === null ? {} : { 'If-None-Match': etag } });
    } catch {
      return err({ kind: 'offline' });
    }
    if (response.status === NOT_MODIFIED) {
      return ok({ kind: 'unchanged' });
    }
    if (!response.ok) {
      return err({ kind: 'http', status: response.status });
    }
    const body = await response.text();
    return looksLikeCalendar(body)
      ? ok({ kind: 'body', body, etag: response.headers.get('ETag') })
      : err({ kind: 'not-a-calendar' });
  },

  events(body, from, to) {
    const calendar = new ICAL.Component(ICAL.parse(body));
    for (const zone of calendar.getAllSubcomponents('vtimezone')) {
      ICAL.TimezoneService.register(zone);
    }
    const byUid = new Map<string, ICAL.Event>();
    const exceptions: ICAL.Event[] = [];
    for (const component of calendar.getAllSubcomponents('vevent')) {
      const event = new ICAL.Event(component);
      if (component.getFirstPropertyValue('status') === 'CANCELLED') {
        continue;
      }
      if (event.isRecurrenceException()) {
        exceptions.push(event);
      } else {
        byUid.set(event.uid, event);
      }
    }
    for (const exception of exceptions) {
      byUid.get(exception.uid)?.relateException(exception);
    }
    const fromSeconds = from.epochMilliseconds / SECONDS_TO_MILLISECONDS;
    const toSeconds = to.epochMilliseconds / SECONDS_TO_MILLISECONDS;
    return [...byUid.values()].flatMap(event => {
      const busy = event.component.getFirstPropertyValue('transp') !== 'TRANSPARENT';
      if (!event.isRecurring()) {
        const inside =
          event.endDate.toUnixTime() > fromSeconds && event.startDate.toUnixTime() < toSeconds;
        return inside ? [eventOf(event, event.startDate, event.endDate, busy)] : [];
      }
      const occurrences: ICalendarEvent[] = [];
      const iterator = event.iterator();
      for (let count = 0; count < MAX_OCCURRENCES_PER_EVENT; count += 1) {
        const next = iterator.next();
        if (next === undefined || next === null || next.toUnixTime() >= toSeconds) {
          break;
        }
        const details = event.getOccurrenceDetails(next);
        if (details.endDate.toUnixTime() > fromSeconds) {
          occurrences.push(eventOf(details.item, details.startDate, details.endDate, busy));
        }
      }
      return occurrences;
    });
  },
};
