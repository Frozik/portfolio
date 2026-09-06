import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { computeLunarPosition } from './lunarPosition';

const SAINT_PETERSBURG = { latitudeDegrees: 59.9386, longitudeDegrees: 30.3141 };
/** Solar midnight in Saint Petersburg on the night of the June 2026 full moon. */
const FULL_MOON_MIDNIGHT = Temporal.Instant.from('2026-06-29T22:00:00Z');

describe('computeLunarPosition', () => {
  const moon = computeLunarPosition(
    FULL_MOON_MIDNIGHT,
    SAINT_PETERSBURG.latitudeDegrees,
    SAINT_PETERSBURG.longitudeDegrees
  );

  it('puts the full moon opposite the Sun: due south at solar midnight', () => {
    expect(moon.azimuthDegrees).toBeGreaterThan(160);
    expect(moon.azimuthDegrees).toBeLessThan(200);
  });

  it('keeps a summer full moon low over the horizon at 60° north', () => {
    expect(moon.altitudeDegrees).toBeGreaterThan(0);
    expect(moon.altitudeDegrees).toBeLessThan(12);
  });

  it('answers a distance between perigee and apogee', () => {
    expect(moon.distanceKm).toBeGreaterThan(356_000);
    expect(moon.distanceKm).toBeLessThan(407_000);
  });
});
