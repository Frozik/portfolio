import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { moonEquatorialCoordinates } from './lunarCoordinates';
import { daysSinceJ2000, DEGREES_TO_RADIANS } from './solarCoordinates';

/**
 * Meeus, "Astronomical Algorithms", example 47.a: 1992 April 12 at 0h TD.
 * The day count is taken from the instant as-is, because the example is
 * already on the Terrestrial Time scale.
 */
const EXAMPLE_47A_TT = daysSinceJ2000(Temporal.Instant.from('1992-04-12T00:00:00Z'));

describe('moonEquatorialCoordinates', () => {
  const moon = moonEquatorialCoordinates(EXAMPLE_47A_TT);

  it('reproduces the apparent right ascension of example 47.a', () => {
    expect(moon.rightAscensionRadians / DEGREES_TO_RADIANS).toBeCloseTo(134.68847, 2);
  });

  it('reproduces the apparent declination of example 47.a', () => {
    expect(moon.declinationRadians / DEGREES_TO_RADIANS).toBeCloseTo(13.768368, 2);
  });

  it('reproduces the distance of example 47.a to the kilometre', () => {
    expect(moon.distanceKm).toBeCloseTo(368409.7, 0);
  });
});
