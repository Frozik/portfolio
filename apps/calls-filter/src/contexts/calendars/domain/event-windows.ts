import type { TFloatingMinute } from '../../policy/domain/floating-time';
import { floatingDateStart, floatingMinute } from '../../policy/domain/floating-time';
import type { IEventFilter } from '../../policy/domain/policy';
import type { TWindowSet } from '../../policy/domain/window-set';
import { normalizeWindows } from '../../policy/domain/window-set';
import type { ICalendarEvent } from './calendar-event';

/**
 * The windows of the events a rule counts, in floating minutes: a timed event at the wall
 * clock of the zone the phone is in, an all-day one as whole local days; the buffers widen
 * each. The service checks the same filter when it reads a device calendar live.
 */
export function eventWindows(
  events: readonly ICalendarEvent[],
  filter: IEventFilter,
  zone: string
): TWindowSet {
  return normalizeWindows(
    events
      .filter(event => !filter.skipDeclined || !event.declined)
      .filter(event => filter.includeAllDay || !event.allDay)
      .map(event => {
        const from = event.allDay
          ? floatingDateStart(event.startDate)
          : floatingMinute(event.start.toZonedDateTimeISO(zone).toPlainDateTime());
        const to = event.allDay
          ? floatingDateStart(event.endDate)
          : floatingMinute(event.end.toZonedDateTimeISO(zone).toPlainDateTime());
        return {
          from: (from - filter.minutesBefore) as TFloatingMinute,
          to: (to + filter.minutesAfter) as TFloatingMinute,
        };
      })
  );
}
