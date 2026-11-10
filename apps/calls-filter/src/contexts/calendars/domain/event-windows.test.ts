import { Temporal } from 'temporal-polyfill';

import type { ICalendarEvent } from './calendar-event';
import { eventWindows } from './event-windows';

const ZONE = 'Europe/Amsterdam';

/** A public holiday as a holiday calendar gives it: all day; such calendars mark their days free. */
const KINGS_DAY: ICalendarEvent = {
  start: Temporal.Instant.from('2026-04-26T22:00:00Z'),
  end: Temporal.Instant.from('2026-04-27T22:00:00Z'),
  allDay: true,
  startDate: Temporal.PlainDate.from('2026-04-27'),
  endDate: Temporal.PlainDate.from('2026-04-28'),
  declined: false,
  title: "King's Day",
};

describe('the events a calendar rule counts', () => {
  it('counts an event marked free, as holiday calendars mark their days', () => {
    const windows = eventWindows(
      [KINGS_DAY],
      { skipDeclined: true, includeAllDay: true, minutesBefore: 0, minutesAfter: 0 },
      ZONE
    );

    expect(windows).toHaveLength(1);
  });
});
