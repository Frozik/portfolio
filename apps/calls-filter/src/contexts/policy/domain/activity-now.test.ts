import { Temporal } from 'temporal-polyfill';

import type { TCalendarSource } from '../../calendars/domain/calendar-source';
import { activityNow, isActive } from './activity-now';
import { conditionWindows } from './condition-windows';
import { floatingMinute } from './floating-time';
import type { IPlaceRule, TPlaceId, TPlaceRadius } from './place-rule';
import type { ICalendarRule, IPolicy, IConditions } from './policy';
import { ALWAYS_BLOCK } from './policy';
import { REPEAT_OFF } from './repeat-pass';
import type { ISchedule } from './schedule';
import { scheduleWindows } from './schedule-windows';
import type { TWindowSet } from './window-set';
import { normalizeWindows } from './window-set';

const WEEKDAYS: ISchedule = {
  zone: { kind: 'here' },
  start: Temporal.PlainDate.from('2026-11-02'),
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
  exceptDates: [],
};

const HOLIDAYS: ICalendarRule = {
  source: { kind: 'ics', id: 'holidays' } as TCalendarSource,
  mode: 'except-events',
  filter: {
    skipDeclined: true,
    includeAllDay: true,
    minutesBefore: 0,
    minutesAfter: 0,
  },
};
const MEETINGS: ICalendarRule = {
  source: { kind: 'ics', id: 'meetings' } as TCalendarSource,
  mode: 'except-events',
  filter: {
    skipDeclined: true,
    includeAllDay: false,
    minutesBefore: 0,
    minutesAfter: 0,
  },
};

const WORK_CONDITIONS: IConditions = {
  schedule: WEEKDAYS,
  calendars: [HOLIDAYS, MEETINGS],
  places: [],
};
const WORK: IPolicy = {
  action: 'pass',
  conditions: WORK_CONDITIONS,
  repeatPass: REPEAT_OFF,
  repeatWindowMinutes: 5,
};

function weekdaysOfWeek(): readonly Temporal.PlainDate[] {
  return [2, 3, 4, 5, 6].map(day => Temporal.PlainDate.from({ year: 2026, month: 11, day }));
}

function local(text: string) {
  const dateTime = Temporal.PlainDateTime.from(text);
  return {
    instant: dateTime.toZonedDateTime('Europe/Amsterdam').toInstant(),
    local: floatingMinute(dateTime),
  };
}

function window(from: string, to: string) {
  return {
    from: floatingMinute(Temporal.PlainDateTime.from(from)),
    to: floatingMinute(Temporal.PlainDateTime.from(to)),
  };
}

const EVENTS: Readonly<Record<string, TWindowSet>> = {
  holidays: normalizeWindows([window('2026-11-04T00:00', '2026-11-05T00:00')]),
  meetings: normalizeWindows([window('2026-11-03T14:00', '2026-11-03T15:00')]),
};

function workWindows(): TWindowSet {
  const base = scheduleWindows(WEEKDAYS, weekdaysOfWeek());
  return conditionWindows(WORK_CONDITIONS, base, rule =>
    rule.source.kind === 'ics' ? (EVENTS[rule.source.id] ?? []) : []
  );
}

function workAt(text: string, enabled = true) {
  return activityNow({ policy: WORK, enabled }, local(text), workWindows());
}

describe('«Work» in force on weekdays 09–18 except holidays and meetings', () => {
  it('is in force in working hours', () => {
    expect(workAt('2026-11-03T10:30').activity).toBe('conditions-hold');
  });

  it('is not during a meeting, and says when the meeting ends', () => {
    const during = workAt('2026-11-03T14:30');
    expect(during.activity).toBe('conditions-unmet');
    expect(during.changesAt).toBe(floatingMinute(Temporal.PlainDateTime.from('2026-11-03T15:00')));
  });

  it('is not on a holiday, at the weekend or in the evening', () => {
    expect(workAt('2026-11-04T11:00').activity).toBe('conditions-unmet');
    expect(workAt('2026-11-07T11:00').activity).toBe('conditions-unmet');
    expect(workAt('2026-11-03T18:00').activity).toBe('conditions-unmet');
    expect(workAt('2026-11-03T17:59').activity).toBe('conditions-hold');
  });

  it('ends its working hours early for a meeting that starts inside them', () => {
    expect(workAt('2026-11-03T10:30').changesAt).toBe(
      floatingMinute(Temporal.PlainDateTime.from('2026-11-03T14:00'))
    );
  });

  it('names no time while the place is not met: the clock cannot say when the phone gets there', () => {
    const office: IPlaceRule = {
      id: 'office' as TPlaceId,
      name: 'Office',
      latitude: 52.37,
      longitude: 4.9,
      radius: 500 as TPlaceRadius,
      mode: 'only-at',
    };
    const atOffice = { ...WORK, conditions: { ...WORK_CONDITIONS, places: [office] } };
    expect(
      activityNow(
        { policy: atOffice, enabled: true },
        local('2026-11-03T10:30'),
        workWindows(),
        () => false
      )
    ).toEqual({ activity: 'conditions-unmet', changesAt: null });
  });

  it('is never in force switched off, whatever its conditions say', () => {
    expect(workAt('2026-11-03T10:30', false)).toEqual({ activity: 'off', changesAt: null });
  });
});

describe('a group without conditions', () => {
  it('is always in force, until switched off', () => {
    const moment = local('2026-11-03T10:30');
    expect(activityNow({ policy: ALWAYS_BLOCK, enabled: true }, moment, null).activity).toBe(
      'always'
    );
    expect(isActive('always')).toBe(true);
    expect(isActive('conditions-hold')).toBe(true);
    expect(isActive('conditions-unmet')).toBe(false);
    expect(isActive('off')).toBe(false);
  });
});

describe('schedule windows', () => {
  it('runs a night range past midnight', () => {
    const night: ISchedule = {
      ...WEEKDAYS,
      times: [
        {
          kind: 'range',
          from: Temporal.PlainTime.from('23:00'),
          to: Temporal.PlainTime.from('07:00'),
        },
      ],
    };
    const [first] = scheduleWindows(night, [Temporal.PlainDate.from('2026-11-02')]);
    expect(first).toEqual(window('2026-11-02T23:00', '2026-11-03T07:00'));
  });

  it('counts a day by the wall clock, even the one the clocks go forward on', () => {
    const day = timeless('2026-03-29');
    const [only] = scheduleWindows({ ...WEEKDAYS, times: [{ kind: 'all-day' }] }, [day]);
    expect((only?.to ?? 0) - (only?.from ?? 0)).toBe(1440);
  });
});

function timeless(text: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(text);
}
