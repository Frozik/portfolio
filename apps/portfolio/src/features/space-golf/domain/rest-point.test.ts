import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall } from './ball';
import {
  BALL_RADIUS_METERS,
  CONTACT_EPSILON_METERS,
  FIXED_STEP_SECONDS,
  FLOATER_LARGE_SIDE_METERS,
  SPIKE_WIDTH_METERS,
} from './constants';
import { createFloater } from './floaters';
import type { Level } from './level';
import { createRod, rodTipLength, rodWidth } from './rods';
import { createSpikeRow } from './spikes';
import { step } from './step';
import { createTestLevel } from './test-level';

const base = createTestLevel();
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);
const FLOOR_Y = 1;
const CEILING_Y = 16;
/** The floor's top face runs from x = 10 leftwards, so a row's `from` counts from x = 10. */
const FLOOR_TOP = base.walls[0].edges[2];
const DROP_METERS = 0.3;

function dropped(level: Level, position: Vector2, rods: readonly number[] = []): BallState {
  return { ...createBall(level), phase: 'flying', position, rods };
}

function untilRest(level: Level, ball: BallState): BallState {
  let state = ball;
  for (let tick = 0; tick < 6 * SECOND_STEPS && state.phase === 'flying'; tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  expect(state.phase).toBe('aiming');
  return state;
}

describe('the place a burst ball comes back to', () => {
  it('moves to a ball at rest on a flat face of an island with nothing else about', () => {
    const tee = createBall(base);

    const rested = untilRest(
      base,
      dropped(base, { x: 2.5, y: FLOOR_Y + BALL_RADIUS_METERS + DROP_METERS })
    );

    expect(rested.rest.position).toEqual(rested.position);
    expect(rested.rest.position).not.toEqual(tee.rest.position);
  });

  it('stays behind when the ball rests on a floater: only an island is ground to come back to', () => {
    const center = { x: 2.5, y: 5 };
    const level: Level = { ...base, floaters: [createFloater(center, 'square', true)] };
    const tee = createBall(level);
    const above = center.y + FLOATER_LARGE_SIDE_METERS / 2 + BALL_RADIUS_METERS + DROP_METERS;

    const rested = untilRest(level, dropped(level, { x: center.x, y: above }));

    expect(rested.position.y).toBeGreaterThan(center.y);
    expect(rested.rest).toEqual(tee.rest);
  });

  it('stays behind when the ball rests over a spike row, sunk as it is', () => {
    const level: Level = { ...base, spikes: [createSpikeRow(FLOOR_TOP, 7, 3, false)] };
    const tee = createBall(level);
    const overTheRow = 10 - 7 - 1.5 * SPIKE_WIDTH_METERS;

    const rested = untilRest(
      level,
      dropped(level, { x: overTheRow, y: FLOOR_Y + BALL_RADIUS_METERS + DROP_METERS })
    );

    expect(rested.position.y).toBeCloseTo(FLOOR_Y + BALL_RADIUS_METERS, 2);
    expect(rested.rest).toEqual(tee.rest);
  });

  it('stays behind when the ball rests on the floor against the side of a rod', () => {
    const rodX = 2.5;
    const reach = CEILING_Y - FLOOR_Y + rodTipLength('screw');
    const level: Level = {
      ...base,
      rods: [createRod('screw', { x: rodX, y: CEILING_Y }, { x: 0, y: -1 }, reach)],
    };
    const tee = createBall(level);
    const againstTheRod = {
      x: rodX + rodWidth('screw') / 2 + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS,
      y: FLOOR_Y + BALL_RADIUS_METERS + DROP_METERS,
    };

    const rested = untilRest(level, dropped(level, againstTheRod, [reach]));

    expect(rested.position.y).toBeCloseTo(FLOOR_Y + BALL_RADIUS_METERS, 2);
    expect(rested.rest).toEqual(tee.rest);
  });
});
