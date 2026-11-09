import { assertNever } from '@frozik/utils/assert/assertNever';
import { isEqual } from 'lodash-es';

import type { TCalendarSource } from '../contexts/calendars/domain/calendar-source';
import type { IPlaceRule } from '../contexts/policy/domain/place-rule';
import type { IPolicy } from '../contexts/policy/domain/policy';
import type {
  ISchedule,
  TScheduleTime,
  TScheduleZone,
  TWeekday,
} from '../contexts/policy/domain/schedule';
import type { ITexts } from './texts';

const WEEKDAYS: readonly TWeekday[] = [1, 2, 3, 4, 5];
const WEEKENDS: readonly TWeekday[] = [6, 7];

function timeText(texts: ITexts, time: TScheduleTime): string {
  switch (time.kind) {
    case 'all-day':
      return texts.phrase.allDay;
    case 'range':
      return `${texts.format.time(time.from.hour, time.from.minute)}–${texts.format.time(time.to.hour, time.to.minute)}`;
    default:
      return assertNever(time);
  }
}

function daysText(texts: ITexts, schedule: ISchedule): string {
  const { repeat } = schedule;
  if (repeat === null) {
    return texts.phrase.once(texts.format.dayMonth(schedule.start.day, schedule.start.month));
  }
  const every = repeat.interval > 1;
  switch (repeat.frequency) {
    case 'daily':
      return every ? texts.phrase.everyN(repeat.interval, 'day') : texts.phrase.everyDay;
    case 'weekly': {
      const days = [...repeat.weekdays].sort();
      const named = isEqual(days, WEEKDAYS)
        ? texts.phrase.onWeekdays
        : isEqual(days, WEEKENDS)
          ? texts.phrase.onWeekends
          : texts.phrase.onDays(days.map(texts.format.weekdayShort).join(', '));
      return every ? `${texts.phrase.everyN(repeat.interval, 'week')} ${named}` : named;
    }
    case 'monthly':
      return every ? texts.phrase.everyN(repeat.interval, 'month') : texts.phrase.monthly;
    case 'yearly':
      return every ? texts.phrase.everyN(repeat.interval, 'year') : texts.phrase.yearly;
    default:
      return assertNever(repeat.frequency);
  }
}

/** Whose clock a phrase names: the phone's zone is said by nobody, another zone by its city. */
export interface IClockWords {
  readonly phoneZone: string;
  readonly city: (zone: string) => string;
}

function zoneText(texts: ITexts, zone: TScheduleZone, clock: IClockWords): string | null {
  switch (zone.kind) {
    case 'here':
      return texts.phrase.localTime;
    case 'fixed':
      return zone.zone === clock.phoneZone ? null : texts.phrase.onClockOf(clock.city(zone.zone));
    default:
      return assertNever(zone);
  }
}

/** A schedule as Google Calendar says it: «on weekdays, 09:00–18:00 (Helsinki time), except holidays». */
export function scheduleText(texts: ITexts, schedule: ISchedule, clock: IClockWords): string {
  const holidays =
    schedule.holidays === 'also-on-holidays'
      ? texts.phrase.holidaysAlso
      : schedule.holidays === 'not-on-holidays'
        ? texts.phrase.holidaysNot
        : null;
  const zone = zoneText(texts, schedule.zone, clock);
  const times = schedule.times.map(time => timeText(texts, time)).join(', ');
  return [daysText(texts, schedule), zone === null ? times : `${times} ${zone}`, holidays]
    .filter(part => part !== null && part !== '')
    .join(', ');
}

function placesText(
  texts: ITexts,
  places: readonly IPlaceRule[],
  mode: IPlaceRule['mode']
): string {
  const names = places.filter(place => place.mode === mode).map(place => `«${place.name}»`);
  if (names.length === 0) {
    return '';
  }
  return mode === 'only-at'
    ? texts.phrase.onlyAtPlaces(names.join(', '))
    : texts.phrase.exceptAtPlaces(names.join(', '));
}

/** The policy as one sentence, the way the group screen and the list show it. */
export function policyText(
  texts: ITexts,
  policy: IPolicy,
  calendarName: (source: TCalendarSource) => string,
  clock: IClockWords
): string {
  const { scheduled } = policy;
  if (scheduled === null) {
    return texts.phrase.always(texts.actions[policy.otherwise]);
  }
  const except = scheduled.calendars
    .filter(rule => rule.mode === 'except-events')
    .map(rule => calendarName(rule.source));
  const only = scheduled.calendars
    .filter(rule => rule.mode === 'only-during-events')
    .map(rule => calendarName(rule.source));
  const when = [
    scheduled.schedule === null
      ? except.length === 0 && only.length === 0 && scheduled.places.length === 0
        ? texts.phrase.allTheTime
        : ''
      : scheduleText(texts, scheduled.schedule, clock),
    except.length === 0 ? '' : texts.phrase.exceptEvents(except.join(', ')),
    only.length === 0 ? '' : texts.phrase.onlyDuringEvents(only.join(', ')),
    placesText(texts, scheduled.places, 'only-at'),
    placesText(texts, scheduled.places, 'except-at'),
  ]
    .filter(part => part !== '')
    .join(', ');
  return texts.phrase.scheduled(
    texts.actions[scheduled.action],
    when,
    texts.actions[policy.otherwise]
  );
}
