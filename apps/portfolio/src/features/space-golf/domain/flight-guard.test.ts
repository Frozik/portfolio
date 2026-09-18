import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall, respawn } from './ball';
import {
  FIXED_STEP_SECONDS,
  MAX_AIRBORNE_SECONDS,
  MAX_FLIGHT_SECONDS,
  MAX_SPEED_METERS_PER_SECOND,
} from './constants';
import type { Level } from './level';
import { shoot } from './shot';
import { step } from './step';
import { createTestLevel } from './test-level';

const arena = createTestLevel();
/** Nothing at all: a ball here falls for ever. */
const theVoid: Level = { ...arena, walls: [], cup: undefined };
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);

function flyFor(level: Level, ball: BallState, seconds: number): BallState {
  let state = ball;
  for (
    let tick = 0;
    tick < Math.round(seconds * SECOND_STEPS) && state.phase === 'flying';
    tick += 1
  ) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

describe('a flight that will not end', () => {
  it('bursts a ball that has touched nothing for too long — a fall through a gap in the country with no bottom to it', () => {
    const falling = shoot(theVoid, createBall(theVoid), { x: 1, y: 0 });

    expect(flyFor(theVoid, falling, MAX_AIRBORNE_SECONDS - 0.5).phase).toBe('flying');
    expect(flyFor(theVoid, falling, MAX_AIRBORNE_SECONDS + 0.5).phase).toBe('destroyed');
  });

  it('leaves the highest lob there is alone: straight up at full power comes down and lands long before the limit', () => {
    const lobbed = shoot(arena, createBall(arena), { x: 0, y: MAX_SPEED_METERS_PER_SECOND });

    const landed = flyFor(arena, lobbed, 20);

    expect(landed.phase).toBe('aiming');
  });

  it('bursts a ball that keeps touching things and still never settles, once the flight has gone on too long', () => {
    const restless: BallState = {
      ...shoot(arena, createBall(arena), { x: 3, y: 4 }),
      flightSeconds: MAX_FLIGHT_SECONDS - 0.1,
    };

    expect(flyFor(arena, restless, 0.3).phase).toBe('destroyed');
  });

  it('starts both clocks afresh with every stroke and every respawn', () => {
    const worn: BallState = { ...createBall(arena), flightSeconds: 25, airborneSeconds: 4 };

    const shot = shoot(arena, worn, { x: 1, y: 1 });
    const back = respawn({ ...worn, phase: 'destroyed' });

    expect([shot.flightSeconds, shot.airborneSeconds]).toEqual([0, 0]);
    expect([back.flightSeconds, back.airborneSeconds]).toEqual([0, 0]);
  });
});
