import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall, respawn } from './ball';
import {
  BALL_RADIUS_METERS,
  BOARD_HEIGHT_METERS,
  BOARD_WIDTH_METERS,
  CONTACT_EPSILON_METERS,
  FIXED_STEP_SECONDS,
} from './constants';
import type { Level, Pickup, Wall } from './level';
import { shoot } from './shot';
import { step } from './step';
import { createBlock, createWall } from './walls';

const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);
const FLOOR_TOP = 1;

/** A floor slab and nothing else: the board is open on every other side. */
function openLevel(floor: Wall, pickups: readonly Pickup[] = []): Level {
  return {
    seed: 0,
    width: BOARD_WIDTH_METERS,
    height: BOARD_HEIGHT_METERS,
    walls: [floor],
    spikes: [],
    pickups,
    tee: { x: 4.5, y: FLOOR_TOP + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS },
    cup: { wall: 0, edge: 2, at: 0.5, radius: 0.2 },
    par: 1,
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

  it('lets the ball fly off the board and bursts it after three seconds out there', () => {
    const launched = shoot(createBall(level), { x: 10, y: 0 });

    const away = fly(level, launched, 2);
    expect(away.phase).toBe('flying');
    expect(away.position.x).toBeGreaterThan(BOARD_WIDTH_METERS);
    expect(away.offscreenSeconds).toBeGreaterThan(0);

    const gone = fly(level, launched, 5);
    expect(gone.phase).toBe('destroyed');
    expect(respawn(gone).position).toEqual(level.tee);
  });

  it('bursts a ball that would come to rest beyond the edge instead of leaving it there', () => {
    const bleeding = openLevel(createBlock(-1, 0, BOARD_WIDTH_METERS + 2, FLOOR_TOP));
    const start = { ...createBall(bleeding), position: { x: 8, y: bleeding.tee.y } };

    const state = fly(bleeding, shoot(start, { x: 3, y: 0 }), 8);

    expect(state.phase).toBe('destroyed');
    expect(state.position.x).toBeGreaterThan(BOARD_WIDTH_METERS);
  });

  it('collects a pickup the ball rolls through and keeps it through a burst', () => {
    const pickup: Pickup = { position: { x: 6, y: FLOOR_TOP + 0.2 }, shape: 'diamond' };
    const withPickup = openLevel(createBlock(0, 0, BOARD_WIDTH_METERS, FLOOR_TOP), [pickup]);

    const rolled = fly(withPickup, shoot(createBall(withPickup), { x: 3, y: 0 }), 1);
    expect([...rolled.collected]).toEqual([0]);

    const reborn = respawn({ ...rolled, phase: 'destroyed' });
    expect([...reborn.collected]).toEqual([0]);
  });

  it('lets the ball settle on an elastic bar after a few ever smaller hops', () => {
    const slab = createBlock(0, 0, BOARD_WIDTH_METERS, FLOOR_TOP);
    const elastic = openLevel(
      createWall(slab.vertices, new Set(slab.edges.map((_, index) => index)))
    );
    const dropped: BallState = {
      ...createBall(elastic),
      phase: 'flying',
      position: { x: 4.5, y: FLOOR_TOP + 0.5 },
    };

    const state = fly(elastic, dropped, 6);

    expect(state.phase).toBe('aiming');
    expect(state.down).toEqual({ x: 0, y: -1 });
    expect(state.position.y).toBeCloseTo(elastic.tee.y, 2);
  });
});
