import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LATITUDE_DEGREES,
  DEFAULT_LONGITUDE_DEGREES,
  DEFAULT_TIME_ZONE_ID,
} from '../constants';
import { computeSunPosition } from './sun-position';

const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Solar noon of the summer solstice at the default site (Saint Petersburg): the
 * sun stands due south at 90° − 59.94° + 23.44° ≈ 53.5° over the horizon, which
 * is the fixed point the whole sun study is checked against.
 */
const SOLSTICE_NOON = Temporal.ZonedDateTime.from(`2026-06-21T13:00:00[${DEFAULT_TIME_ZONE_ID}]`);

const SAINT_PETERSBURG = {
  latitudeDegrees: DEFAULT_LATITUDE_DEGREES,
  longitudeDegrees: DEFAULT_LONGITUDE_DEGREES,
};

describe('computeSunPosition', () => {
  it('puts the solstice noon sun due south of Saint Petersburg', () => {
    const { azimuthRadians } = computeSunPosition({ moment: SOLSTICE_NOON, ...SAINT_PETERSBURG });

    expect(azimuthRadians * RADIANS_TO_DEGREES).toBeCloseTo(180, 0);
  });

  it('lifts it to the solstice altitude of that latitude', () => {
    const { altitudeRadians } = computeSunPosition({ moment: SOLSTICE_NOON, ...SAINT_PETERSBURG });
    const altitudeDegrees = altitudeRadians * RADIANS_TO_DEGREES;

    expect(altitudeDegrees).toBeGreaterThan(53);
    expect(altitudeDegrees).toBeLessThan(54);
  });

  it('puts the sun under the horizon at midnight', () => {
    const midnight = SOLSTICE_NOON.withPlainTime({ hour: 0 });
    const { altitudeRadians } = computeSunPosition({ moment: midnight, ...SAINT_PETERSBURG });

    expect(altitudeRadians).toBeLessThan(0);
  });

  it('follows the sun eastwards as the morning wears on', () => {
    const morning = SOLSTICE_NOON.withPlainTime({ hour: 8 });
    const morningPosition = computeSunPosition({ moment: morning, ...SAINT_PETERSBURG });
    const noonPosition = computeSunPosition({ moment: SOLSTICE_NOON, ...SAINT_PETERSBURG });

    expect(morningPosition.azimuthRadians).toBeLessThan(noonPosition.azimuthRadians);
    expect(morningPosition.altitudeRadians).toBeLessThan(noonPosition.altitudeRadians);
  });
});
