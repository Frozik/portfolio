import { describe, expect, it } from 'vitest';

import { DEFAULT_NORTH_OFFSET_DEGREES } from '../constants';
import { computeSunDirection, computeSunlight } from './sun-direction';
import type { SunPosition } from './sun-position';

const RADIANS_TO_DEGREES = 180 / Math.PI;
const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Solar noon of the summer solstice at the default site (Saint Petersburg): due
 * south, 90° − 59.94° + 23.44° ≈ 53.5° over the horizon.
 */
const SOLSTICE_NOON_POSITION: SunPosition = positionOf(180, 53.5);

function positionOf(azimuthDegrees: number, altitudeDegrees: number): SunPosition {
  return {
    azimuthRadians: azimuthDegrees * DEGREES_TO_RADIANS,
    altitudeRadians: altitudeDegrees * DEGREES_TO_RADIANS,
  };
}

describe('computeSunDirection', () => {
  it('sends the solstice noon sun of Saint Petersburg into the south at ~53.5°', () => {
    const [x, y, z] = computeSunDirection(SOLSTICE_NOON_POSITION, DEFAULT_NORTH_OFFSET_DEGREES);

    // World +Z is south, so the light falls from the south onto the site.
    expect(z).toBeGreaterThan(0);
    expect(Math.abs(x)).toBeLessThan(0.05);
    expect(Math.asin(y) * RADIANS_TO_DEGREES).toBeGreaterThan(53);
    expect(Math.asin(y) * RADIANS_TO_DEGREES).toBeLessThan(54);
  });

  it('sends a sunrise in the east onto +X', () => {
    const [x, y, z] = computeSunDirection(positionOf(90, 0), DEFAULT_NORTH_OFFSET_DEGREES);

    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });

  it('sends the midnight sun of a polar site into −Z, the plan north', () => {
    const [, , z] = computeSunDirection(positionOf(0, 5), DEFAULT_NORTH_OFFSET_DEGREES);

    expect(z).toBeLessThan(0);
  });

  it('returns a unit vector', () => {
    const [x, y, z] = computeSunDirection(positionOf(215, 32), DEFAULT_NORTH_OFFSET_DEGREES);

    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  });

  it('turns the sun with the plot: a plan north 90° east of true north moves the southern sun to +X', () => {
    const [x, , z] = computeSunDirection(SOLSTICE_NOON_POSITION, 90);

    expect(x).toBeGreaterThan(0);
    expect(Math.abs(z)).toBeLessThan(0.05);
  });

  it('leaves the altitude untouched by the plot rotation', () => {
    const [, straight] = computeSunDirection(SOLSTICE_NOON_POSITION, DEFAULT_NORTH_OFFSET_DEGREES);
    const [, rotated] = computeSunDirection(SOLSTICE_NOON_POSITION, 90);

    expect(rotated).toBeCloseTo(straight);
  });
});

describe('computeSunlight', () => {
  it('lights the scene while the sun is up', () => {
    expect(computeSunlight(positionOf(180, 20), DEFAULT_NORTH_OFFSET_DEGREES).intensity).toBe(1);
  });

  it('leaves the scene on its ambient light once the sun has set', () => {
    expect(computeSunlight(positionOf(300, -2), DEFAULT_NORTH_OFFSET_DEGREES).intensity).toBe(0);
  });
});
