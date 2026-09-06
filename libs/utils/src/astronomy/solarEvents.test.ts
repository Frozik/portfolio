import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { MS_PER_DAY } from '../date/constants';
import { computeSolarEvents } from './solarEvents';

const SAINT_PETERSBURG = { latitudeDegrees: 59.9386, longitudeDegrees: 30.3141 };
/** Longyearbyen: polar day in June, polar night in December. */
const SVALBARD = { latitudeDegrees: 78.22, longitudeDegrees: 15.65 };
const MOSCOW_ZONE = 'Europe/Moscow';

function hourOf(instant: Temporal.Instant | undefined, timeZoneId: string): number | undefined {
  if (instant === undefined) {
    return undefined;
  }

  const local = instant.toZonedDateTimeISO(timeZoneId);

  return local.hour + local.minute / 60;
}

describe('computeSolarEvents', () => {
  it('spans a summer solstice day in Saint Petersburg from early morning to late evening', () => {
    const events = computeSolarEvents(
      Temporal.Instant.from('2026-06-21T10:00:00Z'),
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );

    expect(hourOf(events.sunrise, MOSCOW_ZONE)).toBeCloseTo(3.6, 1);
    expect(hourOf(events.sunset, MOSCOW_ZONE)).toBeCloseTo(22.4, 1);
    expect(hourOf(events.solarNoon, MOSCOW_ZONE)).toBeCloseTo(13, 0);
  });

  it('answers the same day whatever time of it is asked at', () => {
    const atMidnight = computeSolarEvents(
      Temporal.Instant.from('2026-06-21T00:30:00Z'),
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );
    const atNoon = computeSolarEvents(
      Temporal.Instant.from('2026-06-21T12:00:00Z'),
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );

    expect(atMidnight.sunrise?.epochMilliseconds).toBe(atNoon.sunrise?.epochMilliseconds);
  });

  it('leaves a much shorter day at the winter solstice', () => {
    const summer = computeSolarEvents(
      Temporal.Instant.from('2026-06-21T10:00:00Z'),
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );
    const winter = computeSolarEvents(
      Temporal.Instant.from('2026-12-21T10:00:00Z'),
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );
    const lengthOf = (events: typeof summer): number =>
      (events.sunset?.epochMilliseconds ?? 0) - (events.sunrise?.epochMilliseconds ?? 0);

    expect(lengthOf(winter)).toBeLessThan(lengthOf(summer));
  });

  it('keeps the civil twilight but never ends the nautical one on a white night', () => {
    const events = computeSolarEvents(
      Temporal.Instant.from('2026-06-21T10:00:00Z'),
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );

    expect(events.daylight).toBe('normal');
    expect(events.civilDawn).toBeDefined();
    expect(events.nauticalDawn).toBeUndefined();
    expect(events.astronomicalDawn).toBeUndefined();
  });

  it('sees the sunrise earlier from a tower than from the ground', () => {
    const noon = Temporal.Instant.from('2026-03-20T10:00:00Z');
    const ground = computeSolarEvents(
      noon,
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );
    const tower = computeSolarEvents(
      noon,
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees,
      { observerHeightMeters: 100 }
    );

    expect(Temporal.Instant.compare(tower.sunrise ?? noon, ground.sunrise ?? noon)).toBeLessThan(0);
    expect(Temporal.Instant.compare(tower.sunset ?? noon, ground.sunset ?? noon)).toBeGreaterThan(
      0
    );
  });

  it('puts the nadir half a day before the solar noon', () => {
    const events = computeSolarEvents(
      Temporal.Instant.from('2026-06-21T10:00:00Z'),
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );

    expect(events.solarNoon.epochMilliseconds - events.nadir.epochMilliseconds).toBe(
      MS_PER_DAY / 2
    );
  });

  it('reports no sunrise and no sunset through a polar day', () => {
    const events = computeSolarEvents(
      Temporal.Instant.from('2026-06-21T10:00:00Z'),
      SVALBARD.latitudeDegrees,
      SVALBARD.longitudeDegrees
    );

    expect(events.sunrise).toBeUndefined();
    expect(events.sunset).toBeUndefined();
    expect(events.daylight).toBe('polar-day');
  });

  it('reports no sunrise and no sunset through a polar night', () => {
    const events = computeSolarEvents(
      Temporal.Instant.from('2026-12-21T10:00:00Z'),
      SVALBARD.latitudeDegrees,
      SVALBARD.longitudeDegrees
    );

    expect(events.sunrise).toBeUndefined();
    expect(events.sunset).toBeUndefined();
    expect(events.daylight).toBe('polar-night');
  });
});
