import { Temporal } from 'temporal-polyfill';

import { resolveAvailability } from './availability';

const WINDOW = { awakeStartHour: 10, awakeEndHour: 23 };
const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.PlainDateTime.from(iso).toZonedDateTime('Europe/Moscow');

describe('availability', () => {
  it('is online during the awake window on a weekday', () => {
    expect(resolveAvailability(at('2026-09-02T12:00'), WINDOW)).toEqual({
      status: 'online',
      isAwake: true,
    });
  });

  it('is away outside the window on a weekday', () => {
    expect(resolveAvailability(at('2026-09-02T23:30'), WINDOW)).toEqual({
      status: 'away',
      isAwake: false,
    });
  });

  it('reports the weekend whatever the hour, keeping the awake flag', () => {
    expect(resolveAvailability(at('2026-09-05T12:00'), WINDOW)).toEqual({
      status: 'weekend',
      isAwake: true,
    });
    expect(resolveAvailability(at('2026-09-06T03:00'), WINDOW)).toEqual({
      status: 'weekend',
      isAwake: false,
    });
  });
});
