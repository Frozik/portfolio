import { EDayOfWeek } from '@frozik/utils/date/constants';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import type { IAxisMapping } from '../viewport/axis-mapping';
import { timeDomain } from '../viewport/time-domain';
import type { ISchedule } from './schedule';
import { schedule } from './schedule-cuts';

const MOSCOW = 'Europe/Moscow';
const WEEKDAYS = [
  EDayOfWeek.Monday,
  EDayOfWeek.Tuesday,
  EDayOfWeek.Wednesday,
  EDayOfWeek.Thursday,
  EDayOfWeek.Friday,
];

function at(dateTime: string, timeZone = MOSCOW): bigint {
  return Temporal.PlainDateTime.from(dateTime).toZonedDateTime(timeZone).epochNanoseconds;
}

function mappingOf(definition: ISchedule, timeZone = MOSCOW): IAxisMapping<bigint> {
  return schedule(definition).mappingOf(timeDomain({ timeZone }));
}

/** The cuts whose virtual position falls in a world range, as date-times of the zone. */
function cutsBetween(
  mapping: IAxisMapping<bigint>,
  from: string,
  to: string,
  timeZone = MOSCOW
): readonly (readonly [string, string])[] {
  const label = (moment: bigint): string =>
    Temporal.Instant.fromEpochNanoseconds(moment)
      .toZonedDateTimeISO(timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' });
  return mapping
    .cutsIn({
      start: mapping.toVirtual(at(from, timeZone)),
      end: mapping.toVirtual(at(to, timeZone)),
    })
    .map(cut => [label(cut.from), label(cut.to)] as const);
}

describe('a schedule of trading sessions', () => {
  // 2026-05-11 is a Monday.
  const session: ISchedule = {
    entries: [{ kind: 'weekly', effect: 'open', days: WEEKDAYS, from: '09:00', to: '23:00' }],
  };

  it('cuts the night of every working day and the weekend in one piece', () => {
    expect(cutsBetween(mappingOf(session), '2026-05-11T00:00', '2026-05-18T22:00')).toEqual([
      ['2026-05-08T23:00', '2026-05-11T09:00'],
      ['2026-05-11T23:00', '2026-05-12T09:00'],
      ['2026-05-12T23:00', '2026-05-13T09:00'],
      ['2026-05-13T23:00', '2026-05-14T09:00'],
      ['2026-05-14T23:00', '2026-05-15T09:00'],
      ['2026-05-15T23:00', '2026-05-18T09:00'],
    ]);
  });

  it('runs the virtual axis through the open hours only', () => {
    const mapping = mappingOf(session);
    const open =
      mapping.toVirtual(at('2026-05-11T23:00')) - mapping.toVirtual(at('2026-05-11T09:00'));
    const overnight =
      mapping.toVirtual(at('2026-05-12T09:00')) - mapping.toVirtual(at('2026-05-11T23:00'));
    const weekend =
      mapping.toVirtual(at('2026-05-18T09:00')) - mapping.toVirtual(at('2026-05-15T23:00'));

    expect(open).toBe(BigInt(Temporal.Duration.from({ hours: 14 }).total('nanoseconds')));
    expect(overnight).toBe(0n);
    expect(weekend).toBe(0n);
    expect(mapping.isCut(at('2026-05-16T12:00'))).toBe(true);
    expect(mapping.isCut(at('2026-05-11T12:00'))).toBe(false);
    expect(mapping.toWorld(mapping.toVirtual(at('2026-05-11T12:00')))).toBe(at('2026-05-11T12:00'));
  });

  it('closes a holiday on top of the week and a lunch inside the day, closed winning over open', () => {
    const mapping = mappingOf({
      entries: [
        ...session.entries,
        { kind: 'weekly', effect: 'closed', days: WEEKDAYS, from: '13:00', to: '14:00' },
        { kind: 'once', effect: 'closed', from: '2026-05-12T00:00', to: '2026-05-13T00:00' },
      ],
    });

    expect(cutsBetween(mapping, '2026-05-11T10:00', '2026-05-13T22:00')).toEqual([
      ['2026-05-11T13:00', '2026-05-11T14:00'],
      ['2026-05-11T23:00', '2026-05-13T09:00'],
      ['2026-05-13T13:00', '2026-05-13T14:00'],
    ]);
  });

  it('opens a single Saturday session that the weekly entries would leave closed', () => {
    const mapping = mappingOf({
      entries: [
        ...session.entries,
        { kind: 'once', effect: 'open', from: '2026-05-16T10:00', to: '2026-05-16T18:00' },
      ],
    });

    expect(cutsBetween(mapping, '2026-05-15T22:00', '2026-05-18T10:00')).toEqual([
      ['2026-05-15T23:00', '2026-05-16T10:00'],
      ['2026-05-16T18:00', '2026-05-18T09:00'],
    ]);
  });

  it('leaves everything open but the weekend when only closed entries are given', () => {
    const mapping = mappingOf({
      entries: [
        {
          kind: 'weekly',
          effect: 'closed',
          days: [EDayOfWeek.Saturday, EDayOfWeek.Sunday],
          from: '00:00',
          to: '00:00',
        },
      ],
    });

    expect(cutsBetween(mapping, '2026-05-11T12:00', '2026-05-23T12:00')).toEqual([
      ['2026-05-16T00:00', '2026-05-18T00:00'],
      ['2026-05-23T00:00', '2026-05-25T00:00'],
    ]);
  });

  it('runs a session that ends before it starts over midnight', () => {
    const mapping = mappingOf({
      entries: [
        { kind: 'weekly', effect: 'open', days: [EDayOfWeek.Monday], from: '17:00', to: '02:00' },
      ],
    });

    expect(cutsBetween(mapping, '2026-05-11T00:00', '2026-05-12T12:00')).toEqual([
      ['2026-05-05T02:00', '2026-05-11T17:00'],
      ['2026-05-12T02:00', '2026-05-18T17:00'],
    ]);
  });

  it('reads each boundary in its own zone, so the session opens by Sydney and closes by New York', () => {
    const mapping = mappingOf({
      timeZone: 'UTC',
      entries: [
        {
          kind: 'weekly',
          effect: 'open',
          days: WEEKDAYS,
          from: { at: '07:00', timeZone: 'Australia/Sydney' },
          to: { at: '17:00', timeZone: 'America/New_York' },
        },
      ],
    });

    // Sydney is UTC+10 in May and New York UTC−4, so Monday 07:00 Sydney is Sunday 21:00 UTC
    // and Monday 17:00 New York is Monday 21:00 UTC: the days join into one open working week.
    expect(cutsBetween(mapping, '2026-05-08T12:00', '2026-05-12T12:00', 'UTC')).toEqual([
      ['2026-05-08T21:00', '2026-05-10T21:00'],
    ]);
    expect(mapping.isCut(at('2026-05-11T21:30', 'UTC'))).toBe(false);
    expect(mapping.isCut(at('2026-05-09T12:00', 'UTC'))).toBe(true);
    expect(mapping.toWorld(mapping.toVirtual(at('2026-05-09T12:00', 'UTC')), 'before')).toBe(
      at('2026-05-08T21:00', 'UTC')
    );
  });

  it('keeps the session at its local hours across a change to summer time', () => {
    const mapping = mappingOf(session, 'Europe/Berlin');

    // 2026-03-29 the clocks of Berlin go forward.
    expect(cutsBetween(mapping, '2026-03-27T00:00', '2026-03-30T22:00', 'Europe/Berlin')).toEqual([
      ['2026-03-26T23:00', '2026-03-27T09:00'],
      ['2026-03-27T23:00', '2026-03-30T09:00'],
    ]);
    expect(
      mapping.toVirtual(at('2026-03-30T23:00', 'Europe/Berlin')) -
        mapping.toVirtual(at('2026-03-30T09:00', 'Europe/Berlin'))
    ).toBe(BigInt(Temporal.Duration.from({ hours: 14 }).total('nanoseconds')));
  });

  it('reaches back before the epoch and forward past it alike, meeting the world at nought', () => {
    const mapping = mappingOf(session, 'UTC');

    expect(mapping.toVirtual(0n)).toBe(0n);
    // 1969-12-29 is a Monday.
    expect(cutsBetween(mapping, '1969-12-29T00:00', '1970-01-01T22:00', 'UTC')).toEqual([
      ['1969-12-26T23:00', '1969-12-29T09:00'],
      ['1969-12-29T23:00', '1969-12-30T09:00'],
      ['1969-12-30T23:00', '1969-12-31T09:00'],
      ['1969-12-31T23:00', '1970-01-01T09:00'],
    ]);
    const moment = at('1969-12-30T12:00', 'UTC');
    expect(mapping.toWorld(mapping.toVirtual(moment))).toBe(moment);
  });

  it('grows a week at a time while the axis is scrolled without counting the table over again', () => {
    const mapping = mappingOf(session);
    mapping.toVirtual(at('2026-05-11T12:00'));
    const moments = Array.from({ length: 520 }, (_, week) => [
      Temporal.PlainDateTime.from('2026-05-11T12:00').add({ weeks: week }).toZonedDateTime(MOSCOW)
        .epochNanoseconds,
      Temporal.PlainDateTime.from('1969-05-11T12:00')
        .subtract({ weeks: week })
        .toZonedDateTime(MOSCOW).epochNanoseconds,
    ]);
    const started = performance.now();

    for (const [forward, backward] of moments) {
      mapping.toVirtual(forward);
      mapping.toVirtual(backward);
    }

    expect(performance.now() - started).toBeLessThan(500);
  });

  it('covers half a century of weeks in a moment by copying the plain ones', () => {
    const mapping = mappingOf(session);
    const started = performance.now();
    const virtual = mapping.toVirtual(at('2026-05-11T12:00'));

    expect(mapping.toWorld(virtual)).toBe(at('2026-05-11T12:00'));
    expect(performance.now() - started).toBeLessThan(500);
  });
});
