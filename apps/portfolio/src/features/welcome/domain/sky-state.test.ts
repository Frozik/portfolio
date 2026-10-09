import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { computeSkyState } from './sky-state';

const MOSCOW = { latitudeDegrees: 55.7558, longitudeDegrees: 37.6173 };
const TIME_ZONE = 'Europe/Moscow';

function at(isoLocal: string): Temporal.ZonedDateTime {
  return Temporal.PlainDateTime.from(isoLocal).toZonedDateTime(TIME_ZONE);
}

describe('computeSkyState', () => {
  it('points a summer noon at that evening’s sunset', () => {
    const state = computeSkyState(at('2026-06-21T12:00'), MOSCOW);

    expect(state.nextEvent?.kind).toBe('sunset');
    expect(state.nextEvent?.at.toPlainDate().toString()).toBe('2026-06-21');
    expect(state.nextEvent?.at.hour).toBe(21);
  });

  it('points a night after sunset at the next morning’s sunrise', () => {
    const state = computeSkyState(at('2026-06-21T23:30'), MOSCOW);

    expect(state.nextEvent?.kind).toBe('sunrise');
    expect(state.nextEvent?.at.toPlainDate().toString()).toBe('2026-06-22');
  });

  it('points a winter pre-dawn at that morning’s sunrise', () => {
    const state = computeSkyState(at('2026-12-21T05:00'), MOSCOW);

    expect(state.nextEvent?.kind).toBe('sunrise');
    expect(state.nextEvent?.at.toPlainDate().toString()).toBe('2026-12-21');
    expect(state.nextEvent?.at.hour).toBe(8);
  });

  it('counts the whole minutes left until the next event', () => {
    const now = at('2026-06-21T12:00');
    const state = computeSkyState(now, MOSCOW);
    const sunset = state.nextEvent?.at;

    expect(state.nextEvent?.minutesAway).toBe(
      Math.round(now.until(sunset ?? now).total({ unit: 'minutes' }))
    );
  });

  it('carries the Sun halfway across its arc around solar noon', () => {
    const state = computeSkyState(at('2026-06-21T12:30'), MOSCOW);

    expect(state.sunArc).toBeCloseTo(0.5, 1);
  });

  it('takes the Sun off its arc at night', () => {
    expect(computeSkyState(at('2026-06-21T23:30'), MOSCOW).sunArc).toBeUndefined();
  });

  it('puts the Moon on its arc while it is up and takes it off while it is down', () => {
    const moonUp = computeSkyState(at('2026-10-26T01:25'), MOSCOW);
    const moonDown = computeSkyState(at('2026-10-10T01:25'), MOSCOW);

    expect(moonUp.moon.altitudeDegrees).toBeGreaterThan(0);
    expect(moonUp.moonArc).toBeGreaterThan(0);
    expect(moonUp.moonArc).toBeLessThan(1);
    expect(moonDown.moon.altitudeDegrees).toBeLessThan(0);
    expect(moonDown.moonArc).toBeUndefined();
  });

  it('puts the Sun over the horizon at noon and under it at midnight', () => {
    expect(computeSkyState(at('2026-06-21T12:30'), MOSCOW).sun.altitudeDegrees).toBeGreaterThan(50);
    expect(computeSkyState(at('2026-06-21T00:30'), MOSCOW).sun.altitudeDegrees).toBeLessThan(0);
  });
});
