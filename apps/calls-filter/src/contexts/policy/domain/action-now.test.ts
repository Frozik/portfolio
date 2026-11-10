import { Temporal } from 'temporal-polyfill';

import type { TCalendarSource } from '../../calendars/domain/calendar-source';
import { actionNow, temporaryActionOf } from './action-now';
import { floatingMinute } from './floating-time';
import type { ICalendarRule, IPolicy, IScheduledAction } from './policy';
import { REPEAT_OFF } from './repeat-pass';
import type { ISchedule } from './schedule';
import { scheduleWindows } from './schedule-windows';
import { scheduledWindows } from './scheduled-windows';
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

const WORK_SCHEDULED: IScheduledAction = {
  schedule: WEEKDAYS,
  calendars: [HOLIDAYS, MEETINGS],
  places: [],
};
const WORK: IPolicy = {
  otherwise: 'block',
  scheduled: WORK_SCHEDULED,
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
  return scheduledWindows(WORK_SCHEDULED, base, rule =>
    rule.source.kind === 'ics' ? (EVENTS[rule.source.id] ?? []) : []
  );
}

function workAt(text: string) {
  return actionNow({ policy: WORK, temporary: null }, local(text), workWindows());
}

describe('the action of «Work»: pass on weekdays 09–18 except holidays and meetings', () => {
  it('passes in working hours', () => {
    expect(workAt('2026-11-03T10:30')).toMatchObject({ action: 'pass', source: 'scheduled' });
  });

  it('blocks during a meeting, and says when the meeting ends', () => {
    const during = workAt('2026-11-03T14:30');
    expect(during).toMatchObject({ action: 'block', source: 'otherwise' });
    expect(during.changesAt).toEqual({
      kind: 'local',
      at: floatingMinute(Temporal.PlainDateTime.from('2026-11-03T15:00')),
    });
  });

  it('blocks on a holiday all day', () => {
    expect(workAt('2026-11-04T11:00')).toMatchObject({ action: 'block' });
  });

  it('blocks at the weekend and in the evening', () => {
    expect(workAt('2026-11-07T11:00')).toMatchObject({ action: 'block' });
    expect(workAt('2026-11-03T18:00')).toMatchObject({ action: 'block' });
    expect(workAt('2026-11-03T17:59')).toMatchObject({ action: 'pass' });
  });

  it('lets a temporary policy win while it lasts', () => {
    const temporary = {
      action: 'pass' as const,
      until: { kind: 'instant' as const, at: Temporal.Instant.from('2026-11-08T00:00:00Z') },
      setAt: Temporal.Instant.from('2026-11-01T00:00:00Z'),
    };
    expect(
      actionNow({ policy: WORK, temporary }, local('2026-11-07T11:00'), workWindows())
    ).toMatchObject({
      action: 'pass',
      source: 'temporary',
    });
    expect(
      actionNow({ policy: WORK, temporary }, local('2026-11-09T11:00'), workWindows()).source
    ).not.toBe('temporary');
  });

  it('changes for a while to the opposite of what it does now', () => {
    expect(temporaryActionOf(workAt('2026-11-03T17:59'))).toBe('block');
    expect(temporaryActionOf(workAt('2026-11-03T18:00'))).toBe('pass');
  });

  it('keeps the action of a change for a while that is still running, so a new term only extends it', () => {
    const temporary = {
      action: 'block' as const,
      until: { kind: 'instant' as const, at: Temporal.Instant.from('2026-11-08T00:00:00Z') },
      setAt: Temporal.Instant.from('2026-11-01T00:00:00Z'),
    };
    expect(
      temporaryActionOf(
        actionNow({ policy: WORK, temporary }, local('2026-11-07T11:00'), workWindows())
      )
    ).toBe('block');
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
