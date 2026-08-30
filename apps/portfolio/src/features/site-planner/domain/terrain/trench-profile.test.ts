import { describe, expect, it } from 'vitest';

import { TRENCH_WIDTH_METERS } from '../model/routing';
import { buildTrenchProfile } from './trench-profile';

const FLAT_GROUND = () => 10;

describe('buildTrenchProfile', () => {
  it('holds a pressurized run at its norm burial under the terrain', () => {
    const profile = buildTrenchProfile({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      system: 'water',
      burialDepthMeters: 2,
      diameterMeters: 0.032,
      sampleElevation: FLAT_GROUND,
    });

    expect(profile).toBeDefined();
    expect(profile?.minDepthMeters).toBeCloseTo(2);
    expect(profile?.maxDepthMeters).toBeCloseTo(2);
    expect(profile?.slope).toBeUndefined();
    expect(profile?.volumeCubicMeters).toBeCloseTo(10 * 2 * TRENCH_WIDTH_METERS);
  });

  it('drops a sewer at its recommended slope from the entry out', () => {
    const profile = buildTrenchProfile({
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      system: 'sewer',
      burialDepthMeters: 1.8,
      diameterMeters: 0.11,
      sampleElevation: FLAT_GROUND,
    });

    // Ø110 recommends 0.02: twenty metres of run fall forty centimetres.
    expect(profile?.slope).toBeCloseTo(0.02);
    expect(profile?.startDepthMeters).toBeCloseTo(1.8);
    expect(profile?.endDepthMeters).toBeCloseTo(2.2);
  });

  it('shows a gravity run thinning where the terrain falls away', () => {
    // The ground drops one metre over the run — faster than the pipe falls —
    // so the far end is SHALLOWER than the start: exactly what must surface
    // in the profile for the shallow-depth warning to catch.
    const profile = buildTrenchProfile({
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      system: 'sewer',
      burialDepthMeters: 1.8,
      diameterMeters: 0.11,
      sampleElevation: position => 10 - position.x / 20,
    });

    expect(profile?.endDepthMeters).toBeCloseTo(1.8 + 0.4 - 1);
    expect(profile?.minDepthMeters).toBeLessThan(1.8);
  });

  it('refuses a route with no segment', () => {
    expect(
      buildTrenchProfile({
        points: [{ x: 0, y: 0 }],
        system: 'water',
        burialDepthMeters: 2,
        diameterMeters: 0.032,
        sampleElevation: FLAT_GROUND,
      })
    ).toBeUndefined();
  });
});
