import { assertNever } from '@frozik/utils/assert/assertNever';
import { Temporal } from 'temporal-polyfill';
import type { TCalendarSource, TIcsId } from '../contexts/calendars/domain/calendar-source';
import type { ICustomGroup } from '../contexts/grouping/domain/group';
import type { GroupBook } from '../contexts/grouping/domain/group-book';
import type { IMatchingEnvironment } from '../contexts/grouping/domain/matching-environment';
import type { TMemberId } from '../contexts/grouping/domain/member';
import {
  bookOf,
  custom,
  nameMask,
  NETHERLANDS_HOME,
  numberMask,
  pickedContact,
  special,
} from '../contexts/grouping/testing/group-book-fixtures';
import { floatingMinute } from '../contexts/policy/domain/floating-time';
import type { TPlaceId } from '../contexts/policy/domain/place-rule';
import type { ICalendarRule, IPolicy } from '../contexts/policy/domain/policy';
import { ALWAYS_BLOCK, ALWAYS_PASS } from '../contexts/policy/domain/policy';
import { REPEAT_OFF } from '../contexts/policy/domain/repeat-pass';
import type { ISchedule } from '../contexts/policy/domain/schedule';
import type { TWindowSet } from '../contexts/policy/domain/window-set';
import { normalizeWindows } from '../contexts/policy/domain/window-set';
import type { IScreeningInputs } from '../contexts/screening/domain/screening-inputs';
import { RRULE_RECURRENCE_EXPANDER } from '../infrastructure/rrule-recurrence-expander';

/** The phone, the calendars and the books every scenario is decided in. */
const ZONE = 'Europe/Amsterdam';
const HORIZON_START = Temporal.PlainDate.from('2026-11-01');
const HORIZON_END = Temporal.PlainDate.from('2026-11-30');

function at(from: string, to: string) {
  return {
    from: floatingMinute(Temporal.PlainDateTime.from(from)),
    to: floatingMinute(Temporal.PlainDateTime.from(to)),
  };
}

const MEETINGS_ICS: TCalendarSource = { kind: 'ics', id: 'meetings' as TIcsId };
const WORK_CALENDAR: TCalendarSource = {
  kind: 'device',
  accountType: 'com.google',
  accountName: 'me@company.example',
  calendarName: 'Work',
};
/** A holiday calendar the user keeps on the phone: an all-day event a day. */
const HOLIDAY_CALENDAR: TCalendarSource = {
  kind: 'device',
  accountType: 'com.google',
  accountName: 'me@company.example',
  calendarName: 'Holidays',
};
const EVENTS: ReadonlyMap<string, TWindowSet> = new Map([
  ['ics:meetings', normalizeWindows([at('2026-11-03T14:00', '2026-11-03T15:00')])],
  ['device:Work', normalizeWindows([at('2026-11-05T10:00', '2026-11-05T11:30')])],
  ['device:Holidays', normalizeWindows([at('2026-11-04T00:00', '2026-11-05T00:00')])],
]);

function sourceKey(source: TCalendarSource): string {
  switch (source.kind) {
    case 'ics':
      return `ics:${source.id}`;
    case 'device':
      return `device:${source.calendarName}`;
    default:
      return assertNever(source);
  }
}

export const SCENARIO_INPUTS: IScreeningInputs = {
  zone: ZONE,
  horizonStart: HORIZON_START,
  horizonEnd: HORIZON_END,
  occurrencesOf: schedule =>
    RRULE_RECURRENCE_EXPANDER.occurrences(schedule, HORIZON_START, HORIZON_END),
  eventsOf: rule => EVENTS.get(sourceKey(rule.source)) ?? [],
};

export const SCENARIO_ENVIRONMENT: IMatchingEnvironment = NETHERLANDS_HOME;

export function momentOf(local: string) {
  const dateTime = Temporal.PlainDateTime.from(local);
  return { instant: dateTime.toZonedDateTime(ZONE).toInstant(), local: floatingMinute(dateTime) };
}

const FILTER = {
  skipDeclined: true,
  includeAllDay: false,
  minutesBefore: 0,
  minutesAfter: 0,
};
const EXCEPT_MEETINGS: ICalendarRule = {
  source: MEETINGS_ICS,
  mode: 'except-events',
  filter: FILTER,
};
const ONLY_IN_WORK_EVENTS: ICalendarRule = {
  source: WORK_CALENDAR,
  mode: 'only-during-events',
  filter: FILTER,
};
const EXCEPT_HOLIDAY_CALENDAR: ICalendarRule = {
  source: HOLIDAY_CALENDAR,
  mode: 'except-events',
  filter: { ...FILTER, includeAllDay: true },
};

const WEEKDAYS_9_TO_18: ISchedule = {
  zone: { kind: 'here' },
  start: HORIZON_START,
  times: [
    { kind: 'range', from: Temporal.PlainTime.from('09:00'), to: Temporal.PlainTime.from('18:00') },
  ],
  repeat: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [1, 2, 3, 4, 5],
    monthly: null,
    end: { kind: 'never' },
  },
  exceptDates: [Temporal.PlainDate.from('2026-11-13')],
};

const NIGHT: ISchedule = {
  zone: { kind: 'here' },
  start: HORIZON_START,
  times: [
    { kind: 'range', from: Temporal.PlainTime.from('23:00'), to: Temporal.PlainTime.from('07:00') },
  ],
  repeat: { frequency: 'daily', interval: 1, weekdays: [], monthly: null, end: { kind: 'never' } },
  exceptDates: [],
};

const WEEKEND: ISchedule = {
  zone: { kind: 'here' },
  start: HORIZON_START,
  times: [{ kind: 'all-day' }],
  repeat: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [6, 7],
    monthly: null,
    end: { kind: 'never' },
  },
  exceptDates: [],
};

const WORK_POLICY: IPolicy = {
  otherwise: 'block',
  scheduled: {
    action: 'pass',
    schedule: WEEKDAYS_9_TO_18,
    calendars: [EXCEPT_MEETINGS, EXCEPT_HOLIDAY_CALENDAR],
    places: [],
  },
  repeatPass: REPEAT_OFF,
  repeatWindowMinutes: 5,
};

function withPolicy(group: ICustomGroup, policy: IPolicy): ICustomGroup {
  return { ...group, policy };
}

const MUM = pickedContact('Mum', '31612345678');

/** The book the scenarios share: one of every kind of member and policy. */
export const SCENARIO_BOOK: GroupBook = bookOf(
  [
    withPolicy(custom('family', [MUM]), ALWAYS_PASS),
    withPolicy(
      custom('work', [numberMask('+31 20 555 ....')], { excludeMyContacts: false }),
      WORK_POLICY
    ),
    custom('delivery', [numberMask('085 *'), nameMask('*postnl*', 'network')], {
      policy: {
        ...ALWAYS_BLOCK,
        repeatPass: { kind: 'until', until: Temporal.Instant.from('2026-11-08T00:00:00Z') },
        repeatWindowMinutes: 5,
      },
    }),
    custom(
      'spam',
      [numberMask('+7 495*'), special('premium-rate'), nameMask('*klantenservice*', 'network')],
      {
        exclude: [numberMask('+7 495 123 45 67')],
      }
    ),
    custom('hidden', [special('hidden')], {
      policy: {
        otherwise: 'pass',
        scheduled: { action: 'block', schedule: NIGHT, calendars: [], places: [] },
        repeatPass: REPEAT_OFF,
        repeatWindowMinutes: 5,
      },
    }),
    custom('abroad', [special('foreign')], {
      policy: {
        otherwise: 'pass',
        scheduled: {
          action: 'block',
          schedule: null,
          calendars: [EXCEPT_HOLIDAY_CALENDAR],
          places: [],
        },
        repeatPass: REPEAT_OFF,
        repeatWindowMinutes: 5,
      },
    }),
    custom('couriers', [nameMask('courier*', 'contact')], {
      policy: {
        otherwise: 'pass',
        scheduled: {
          action: 'block',
          schedule: null,
          calendars: [ONLY_IN_WORK_EVENTS],
          places: [],
        },
        repeatPass: REPEAT_OFF,
        repeatWindowMinutes: 5,
      },
    }),
    custom('overlap', [numberMask('+7 499*')], { policy: ALWAYS_BLOCK }),
    custom('overlap-lenient', [numberMask('+7 499 1*')], { policy: ALWAYS_PASS }),
  ],
  [{ ...MUM, id: 'mum-out-of-contacts' as TMemberId }, nameMask('courier*', 'contact')]
);

export const EMPTY_BOOK: GroupBook = bookOf([]);

export const TEMPORARY_BOOK: GroupBook = bookOf([
  custom('couriers-now', [numberMask('085 *')], {
    policy: ALWAYS_BLOCK,
    temporary: {
      action: 'pass',
      until: { kind: 'instant', at: Temporal.Instant.from('2026-11-08T00:00:00Z') },
      setAt: Temporal.Instant.from('2026-11-05T00:00:00Z'),
    },
  }),
]);

export const WEEKEND_BOOK: GroupBook = bookOf([
  custom('weekend', [numberMask('*')], {
    policy: {
      otherwise: 'pass',
      scheduled: { action: 'block', schedule: WEEKEND, calendars: [], places: [] },
      repeatPass: REPEAT_OFF,
      repeatWindowMinutes: 5,
    },
  }),
]);

/** An office in Helsinki: 9–18 on Helsinki's clock, read by a phone in Amsterdam. */
export const HELSINKI_OFFICE_BOOK: GroupBook = bookOf([
  custom('helsinki-office', [numberMask('+358 9*')], {
    policy: {
      otherwise: 'block',
      scheduled: {
        action: 'pass',
        schedule: { ...WEEKDAYS_9_TO_18, zone: { kind: 'fixed', zone: 'Europe/Helsinki' } },
        calendars: [],
        places: [],
      },
      repeatPass: REPEAT_OFF,
      repeatWindowMinutes: 5,
    },
  }),
]);

/** Work numbers let through only while the phone is at the office (500 m around it). */
export const OFFICE_ONLY_BOOK: GroupBook = bookOf([
  custom('work-at-office', [numberMask('+31 20*')], {
    policy: {
      otherwise: 'block',
      scheduled: {
        action: 'pass',
        schedule: null,
        calendars: [],
        places: [
          {
            id: 'office' as TPlaceId,
            name: 'Office',
            latitude: 52.3676,
            longitude: 4.9041,
            radius: 500,
            mode: 'only-at',
          },
        ],
      },
      repeatPass: REPEAT_OFF,
      repeatWindowMinutes: 5,
    },
  }),
]);
