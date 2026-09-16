import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall, respawn } from './ball';
import {
  BALL_RADIUS_METERS,
  BOARD_HEIGHT_METERS,
  BOARD_WIDTH_METERS,
  CONTACT_EPSILON_METERS,
  FIXED_STEP_SECONDS,
  CUP_RADIUS_METERS,
} from './constants';
import type { Level, Wall } from './level';
import { shoot } from './shot';
import { step } from './step';
import { createBlock } from './walls';

const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);
const FLOOR_TOP = 1;

/** A floor slab and nothing else: the board is open on every other side. */
function openLevel(floor: Wall): Level {
  return {
    seed: 0,
    width: BOARD_WIDTH_METERS,
    height: BOARD_HEIGHT_METERS,
    walls: [floor],
    tee: { x: 4.5, y: floor.bounds.max.y + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS },
    cup: { wall: 0, edge: 2, at: 0.5, radius: CUP_RADIUS_METERS },
    spikes: [],
  };
}

function fly(level: Level, ball: BallState, seconds: number): BallState {
  let state = ball;
  for (let tick = 0; tick < seconds * SECOND_STEPS && state.phase === 'flying'; tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

describe('the open board', () => {
  const level = openLevel(createBlock(0, 0, BOARD_WIDTH_METERS, FLOOR_TOP));

  it('bursts the ball the moment it leaves the board when gravity will not bring it back', () => {
    const launched = shoot(level, createBall(level), { x: 10, y: 0 });

    const gone = fly(level, launched, 2);

    expect(gone.phase).toBe('destroyed');
    expect(gone.position.x).toBeGreaterThan(BOARD_WIDTH_METERS + BALL_RADIUS_METERS);
    expect(gone.position.x).toBeLessThan(BOARD_WIDTH_METERS + 1);
    expect(respawn(gone).position).toEqual(level.tee);
  });

  it('lets a ball that gravity brings back fly on beyond the edge and land again', () => {
    const high = openLevel(createBlock(0, 0, BOARD_WIDTH_METERS, 12));
    const launched = shoot(high, createBall(high), { x: 0, y: 10 });

    const above = fly(high, launched, 0.9);
    expect(above.phase).toBe('flying');
    expect(above.position.y).toBeGreaterThan(BOARD_HEIGHT_METERS + BALL_RADIUS_METERS);

    const landed = fly(high, launched, 6);
    expect(landed.phase).toBe('aiming');
    expect(landed.position.y).toBeCloseTo(high.tee.y, 2);
  });

  it('bursts a ball that would come to rest beyond the edge instead of leaving it there', () => {
    const bleeding = openLevel(createBlock(-1, 0, BOARD_WIDTH_METERS + 2, FLOOR_TOP));
    const start = { ...createBall(bleeding), position: { x: 8, y: bleeding.tee.y } };

    const state = fly(bleeding, shoot(bleeding, start, { x: 3, y: 0 }), 8);

    expect(state.phase).toBe('destroyed');
    expect(state.position.x).toBeGreaterThan(BOARD_WIDTH_METERS);
  });
});
