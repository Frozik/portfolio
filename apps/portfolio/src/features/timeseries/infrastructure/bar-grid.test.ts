import { schedule } from '@frozik/charts/core/timeline/schedule-cuts';
import { timeDomain } from '@frozik/charts/core/viewport/time-domain';
import { EDayOfWeek } from '@frozik/utils/date/constants';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { HOUR } from '../domain/demo-time';
import { sessionGrid } from './bar-grid';

const at = (dateTime: string): bigint =>
  Temporal.PlainDateTime.from(dateTime).toZonedDateTime('UTC').epochNanoseconds;

describe('a bar grid counted from the opening of each session', () => {
  // 2026-05-11 is a Monday; the sessions run 09:00–23:00 on working days.
  const mapping = schedule({
    entries: [
      {
        kind: 'weekly',
        effect: 'open',
        days: [
          EDayOfWeek.Monday,
          EDayOfWeek.Tuesday,
          EDayOfWeek.Wednesday,
          EDayOfWeek.Thursday,
          EDayOfWeek.Friday,
        ],
        from: '09:00',
        to: '23:00',
      },
    ],
  }).mappingOf(timeDomain());
  const grid = sessionGrid(4n * HOUR, mapping);

  it('starts the bars of a session as it opens', () => {
    expect(grid.floor(at('2026-05-11T09:00'))).toBe(at('2026-05-11T09:00'));
    expect(grid.floor(at('2026-05-11T12:59'))).toBe(at('2026-05-11T09:00'));
    expect(grid.floor(at('2026-05-11T13:00'))).toBe(at('2026-05-11T13:00'));
  });

  it('closes the last bar of a session with the session, short of a full step', () => {
    expect(grid.end(at('2026-05-11T21:00'))).toBe(at('2026-05-11T23:00'));
    expect(grid.end(at('2026-05-11T13:00'))).toBe(at('2026-05-11T17:00'));
  });

  it('steps from the last bar of a session to the first of the next, over the night and the weekend', () => {
    expect(grid.next(at('2026-05-11T21:00'))).toBe(at('2026-05-12T09:00'));
    expect(grid.next(at('2026-05-15T21:00'))).toBe(at('2026-05-18T09:00'));
    expect(grid.previous(at('2026-05-12T09:00'))).toBe(at('2026-05-11T21:00'));
    expect(grid.previous(at('2026-05-18T09:00'))).toBe(at('2026-05-15T21:00'));
  });

  it('stands no bar in a closed stretch: a closed time rounds down to the last bar before it', () => {
    expect(grid.floor(at('2026-05-11T23:00'))).toBe(at('2026-05-11T21:00'));
    expect(grid.floor(at('2026-05-16T12:00'))).toBe(at('2026-05-15T21:00'));
    expect(grid.floor(at('2026-05-12T03:00'))).toBe(at('2026-05-11T21:00'));
  });
});
