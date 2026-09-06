import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { computeLunarIllumination } from './lunarIllumination';

/** The 2026 phases as published in the almanacs. */
const NEW_MOON = Temporal.Instant.from('2026-06-15T02:54:00Z');
const FULL_MOON = Temporal.Instant.from('2026-06-29T23:57:00Z');
const WAXING_NIGHT = Temporal.Instant.from('2026-06-22T00:00:00Z');
const WANING_NIGHT = Temporal.Instant.from('2026-07-05T00:00:00Z');

describe('computeLunarIllumination', () => {
  it('finds the disc dark at new moon', () => {
    expect(computeLunarIllumination(NEW_MOON).fraction).toBeLessThan(0.005);
  });

  it('finds the disc lit at full moon, with the phase at one half', () => {
    const { fraction, phase } = computeLunarIllumination(FULL_MOON);

    expect(fraction).toBeGreaterThan(0.99);
    // The Moon is rarely on the ecliptic at syzygy, so the phase angle stays a few degrees off zero.
    expect(phase).toBeCloseTo(0.5, 1);
  });

  it('tells a waxing moon from a waning one', () => {
    expect(computeLunarIllumination(WAXING_NIGHT).isWaxing).toBe(true);
    expect(computeLunarIllumination(WANING_NIGHT).isWaxing).toBe(false);
  });

  it('runs the phase from a quarter to three quarters between the two', () => {
    expect(computeLunarIllumination(WAXING_NIGHT).phase).toBeCloseTo(0.25, 1);
    expect(computeLunarIllumination(WANING_NIGHT).phase).toBeCloseTo(0.68, 1);
  });
});
