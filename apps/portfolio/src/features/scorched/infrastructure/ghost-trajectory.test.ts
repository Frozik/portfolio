import { describe, expect, it } from 'vitest';

import { createEnvironment } from '../domain/ballistics';
import { DEFAULT_PHYSICS_OPTIONS, GHOST_TRAJECTORY_SECONDS } from '../domain/constants';
import { createFlatHeightfield } from '../domain/terrain/heightfield';
import type { AimState } from '../domain/types';
import { sampleGhostTrajectory } from './ghost-trajectory';

const FLAT_GROUND_WU = 50;
const COLUMN_COUNT = 200;
const NO_WIND = 0;

const AIM: AimState = { facing: 'right', elevationDegrees: 45, power: 600 };

function createRequest(windUnits = NO_WIND) {
  return {
    origin: { x: 20, y: FLAT_GROUND_WU + 4 },
    aim: AIM,
    environment: createEnvironment(DEFAULT_PHYSICS_OPTIONS, windUnits, 'none', COLUMN_COUNT, 400),
    field: createFlatHeightfield(FLAT_GROUND_WU, COLUMN_COUNT),
  };
}

describe('sampleGhostTrajectory', () => {
  it('starts at the muzzle end and runs forward', () => {
    const samples = sampleGhostTrajectory(createRequest());

    expect(samples.length).toBeGreaterThan(1);
    expect(samples[0].position.x).toBeGreaterThan(20);
    expect(samples.at(-1)?.position.x).toBeGreaterThan(samples[0].position.x);
  });

  it('fades with distance so a long shot still takes skill', () => {
    const samples = sampleGhostTrajectory(createRequest());

    expect(samples[0].alpha).toBeGreaterThan(0);
    expect(samples[0].alpha).toBeLessThanOrEqual(1);
    expect(samples.at(-1)?.alpha).toBeLessThan(samples[0].alpha);
    expect(samples.every(sample => sample.alpha > 0)).toBe(true);
  });

  it('never shows more than the first ~1.5 s of flight', () => {
    const samples = sampleGhostTrajectory(createRequest());
    const shownSeconds = GHOST_TRAJECTORY_SECONDS;

    // The ghost is sampled every few ticks, so its count is bounded by the shown flight time.
    expect(samples.length).toBeLessThanOrEqual(Math.ceil(shownSeconds * 60));
  });

  it('bends the arc with the wind the round actually has', () => {
    const calm = sampleGhostTrajectory(createRequest());
    const gale = sampleGhostTrajectory(createRequest(400));

    // Compared at the same point in the flight: a terrain impact can truncate either arc first.
    expect(gale[2].position.x).toBeGreaterThan(calm[2].position.x);
  });

  it('stops at the ground when the shot lands inside the shown window', () => {
    const samples = sampleGhostTrajectory({
      ...createRequest(),
      aim: { facing: 'right', elevationDegrees: 5, power: 200 },
    });

    expect(samples.every(sample => sample.position.y >= FLAT_GROUND_WU - 1)).toBe(true);
  });
});
