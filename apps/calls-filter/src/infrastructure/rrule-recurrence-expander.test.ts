import { Temporal } from 'temporal-polyfill';

import type { ISchedule } from '../contexts/policy/domain/schedule';
import { RRULE_RECURRENCE_EXPANDER } from './rrule-recurrence-expander';

const ALL_DAY = [{ kind: 'all-day' as const }];

function days(
  schedule: Omit<ISchedule, 'zone' | 'times' | 'exceptDates' | 'holidays'>,
  from: string,
  to: string
): readonly string[] {
  return RRULE_RECURRENCE_EXPANDER.occurrences(
    { ...schedule, zone: { kind: 'here' }, times: ALL_DAY, exceptDates: [], holidays: null },
    Temporal.PlainDate.from(from),
    Temporal.PlainDate.from(to)
  ).map(date => date.toString());
}

describe('the days a recurrence picks', () => {
  it('picks the weekdays of a weekly rule', () => {
    expect(
      days(
        {
          start: Temporal.PlainDate.from('2026-11-02'),
          repeat: {
            frequency: 'weekly',
            interval: 1,
            weekdays: [6, 7],
            monthly: null,
            end: { kind: 'never' },
          },
        },
        '2026-11-02',
        '2026-11-15'
      )
    ).toEqual(['2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15']);
  });

  it('picks the second Tuesday of each month', () => {
    expect(
      days(
        {
          start: Temporal.PlainDate.from('2026-01-01'),
          repeat: {
            frequency: 'monthly',
            interval: 1,
            weekdays: [],
            monthly: { kind: 'nth-weekday', nth: 2, weekday: 2 },
            end: { kind: 'never' },
          },
        },
        '2026-11-01',
        '2026-12-31'
      )
    ).toEqual(['2026-11-10', '2026-12-08']);
  });

  it('picks the last Friday with a negative position', () => {
    expect(
      days(
        {
          start: Temporal.PlainDate.from('2026-01-01'),
          repeat: {
            frequency: 'monthly',
            interval: 1,
            weekdays: [],
            monthly: { kind: 'nth-weekday', nth: -1, weekday: 5 },
            end: { kind: 'never' },
          },
        },
        '2026-11-01',
        '2026-11-30'
      )
    ).toEqual(['2026-11-27']);
  });

  it('stops after a count and at an end date', () => {
    const start = Temporal.PlainDate.from('2026-11-02');
    expect(
      days(
        {
          start,
          repeat: {
            frequency: 'daily',
            interval: 2,
            weekdays: [],
            monthly: null,
            end: { kind: 'count', count: 3 },
          },
        },
        '2026-11-01',
        '2026-11-30'
      )
    ).toEqual(['2026-11-02', '2026-11-04', '2026-11-06']);
    expect(
      days(
        {
          start,
          repeat: {
            frequency: 'daily',
            interval: 1,
            weekdays: [],
            monthly: null,
            end: { kind: 'until', date: Temporal.PlainDate.from('2026-11-04') },
          },
        },
        '2026-11-01',
        '2026-11-30'
      )
    ).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('gives a one-off date only inside the range', () => {
    expect(
      days(
        { start: Temporal.PlainDate.from('2026-11-05'), repeat: null },
        '2026-11-01',
        '2026-11-30'
      )
    ).toEqual(['2026-11-05']);
    expect(
      days(
        { start: Temporal.PlainDate.from('2026-12-05'), repeat: null },
        '2026-11-01',
        '2026-11-30'
      )
    ).toEqual([]);
  });

  it('repeats every other week from the start', () => {
    expect(
      days(
        {
          start: Temporal.PlainDate.from('2026-11-02'),
          repeat: {
            frequency: 'weekly',
            interval: 2,
            weekdays: [1],
            monthly: null,
            end: { kind: 'never' },
          },
        },
        '2026-11-01',
        '2026-11-30'
      )
    ).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);
  });
});
