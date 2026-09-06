import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { computeSolarPosition } from './solarPosition';

const SAINT_PETERSBURG = { latitudeDegrees: 59.9386, longitudeDegrees: 30.3141 };
const SYDNEY = { latitudeDegrees: -33.8688, longitudeDegrees: 151.2093 };
/** Solar noon of the 2026 summer solstice in Saint Petersburg (13:00 MSK). */
const SOLSTICE_NOON = Temporal.Instant.from('2026-06-21T10:00:00Z');

function positionAt(instant: Temporal.Instant): ReturnType<typeof computeSolarPosition> {
  return computeSolarPosition(
    instant,
    SAINT_PETERSBURG.latitudeDegrees,
    SAINT_PETERSBURG.longitudeDegrees
  );
}

describe('computeSolarPosition', () => {
  it('puts the solstice noon sun due south', () => {
    expect(positionAt(SOLSTICE_NOON).azimuthDegrees).toBeCloseTo(180, 0);
  });

  it('lifts it to 90° − latitude + the obliquity of the ecliptic', () => {
    const { altitudeDegrees } = positionAt(SOLSTICE_NOON);

    expect(altitudeDegrees).toBeGreaterThan(53);
    expect(altitudeDegrees).toBeLessThan(54);
  });

  it('puts the sun under the horizon at midnight', () => {
    expect(positionAt(SOLSTICE_NOON.subtract({ hours: 13 })).altitudeDegrees).toBeLessThan(0);
  });

  it('carries the sun eastwards through the morning and never above the noon altitude', () => {
    const morning = positionAt(SOLSTICE_NOON.subtract({ hours: 5 }));
    const noon = positionAt(SOLSTICE_NOON);

    expect(morning.azimuthDegrees).toBeLessThan(noon.azimuthDegrees);
    expect(morning.altitudeDegrees).toBeLessThan(noon.altitudeDegrees);
  });

  it('answers a north-based azimuth for an afternoon in the southern hemisphere', () => {
    const sydney = computeSolarPosition(
      Temporal.Instant.from('2026-12-21T05:00:00Z'),
      SYDNEY.latitudeDegrees,
      SYDNEY.longitudeDegrees
    );

    expect(sydney.azimuthDegrees).toBeGreaterThan(180);
    expect(sydney.azimuthDegrees).toBeLessThan(360);
  });
});
