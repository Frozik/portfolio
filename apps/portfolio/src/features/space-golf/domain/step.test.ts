import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall, currentGravity, respawn, turnTo } from './ball';
import {
  BALL_RADIUS_METERS,
  FIXED_STEP_SECONDS,
  GRAVITY_TURN_SECONDS,
  MAX_SPEED_METERS_PER_SECOND,
} from './constants';
import { shoot } from './shot';
import { step } from './step';
import { createTestLevel } from './test-level';

const level = createTestLevel();
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);

function fly(ball: BallState, seconds: number): BallState {
  let state = ball;
  for (let tick = 0; tick < Math.round(seconds * SECOND_STEPS); tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
    if (state.phase !== 'flying') {
      return state;
    }
  }
  return state;
}

function run(ball: BallState, seconds: number): BallState {
  let state = ball;
  for (let tick = 0; tick < Math.round(seconds * SECOND_STEPS); tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

// Summing steps of 1/120 s never lands exactly on a second.
function expectVector(actual: Vector2, expected: Vector2): void {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
}

function ballAt(position: Vector2): BallState {
  return { ...createBall(level), position, rest: { position, down: { x: 0, y: -1 } } };
}

const UP: Vector2 = { x: 0, y: 1 };

describe('step', () => {
  it('makes the vertical wall the floor when the ball hits it', () => {
    const state = fly(shoot(level, ballAt({ x: 7, y: 6 }), { x: 12, y: 0 }), 0.3);

    expect(state.down).toEqual({ x: 1, y: 0 });
    expect(state.velocity.x).toBeLessThan(0);
    expect(state.position.x).toBeLessThanOrEqual(level.width - BALL_RADIUS_METERS);
  });

  it('turns the pull towards the new floor over the turn time, not at the hit', () => {
    const state = fly(shoot(level, ballAt({ x: 7, y: 6 }), { x: 12, y: 0 }), 0.3);

    const gravity = currentGravity(state);
    expect(gravity.x).toBeGreaterThan(0);
    expect(gravity.x).toBeLessThan(1);
    expect(gravity.y).toBeLessThan(0);
    expect(currentGravity(fly(state, GRAVITY_TURN_SECONDS))).toEqual(state.down);
  });

  it('takes the same time for a quarter turn as for a reversal — a turn is a start, an end and a duration', () => {
    const quarter = turnTo(ballAt({ x: 1, y: 2 }), { x: 1, y: 0 });
    const reversal = turnTo(ballAt({ x: 1, y: 2 }), UP);
    const almost = GRAVITY_TURN_SECONDS * 0.75;

    expect(currentGravity(run(quarter, almost)).x).toBeLessThan(0.95);
    expect(currentGravity(run(reversal, almost)).y).toBeLessThan(0.95);
    expectVector(currentGravity(run(quarter, GRAVITY_TURN_SECONDS)), quarter.down);
    expectVector(currentGravity(run(reversal, GRAVITY_TURN_SECONDS)), reversal.down);
  });

  it('reverses the pull through weightlessness — the fall dies out and the rise picks up, no swing to the side', () => {
    const ceiling = shoot(level, turnTo(ballAt({ x: 2, y: 10 }), UP), { x: 0, y: 0 });
    // Easing out, the pull is halfway — nil — before half the time has passed.
    const weightless = GRAVITY_TURN_SECONDS * (1 - Math.SQRT1_2);

    const midway = fly(ceiling, weightless);
    expect(currentGravity(midway).x).toBe(0);
    expect(currentGravity(midway).y).toBeCloseTo(0, 1);
    expect(midway.velocity.y).toBeLessThan(0);
    expect(midway.position.y).toBeLessThan(10);

    const turned = fly(midway, GRAVITY_TURN_SECONDS);
    expectVector(currentGravity(turned), UP);
    expect(turned.velocity.y).toBeGreaterThan(midway.velocity.y);
  });

  it('leaves the old floor fast and settles on the new one softly', () => {
    const quarter = GRAVITY_TURN_SECONDS / 4;
    const turn = turnTo(ballAt({ x: 1, y: 2 }), { x: 1, y: 0 });

    const early = currentGravity(run(turn, quarter)).x;
    const late = 1 - currentGravity(run(turn, GRAVITY_TURN_SECONDS - quarter)).x;

    expect(early).toBeGreaterThan(0.4);
    expect(late).toBeLessThan(0.1);
  });

  it('lets a running turn finish while the ball rolls along the very floor it turns to', () => {
    // Far from the left wall: the fading leftward pull must not reach it within the turn.
    const onFloor = ballAt({ x: 8.5, y: level.tee.y });
    const rolling = shoot(
      level,
      { ...onFloor, turn: { from: { x: -1, y: 0 }, elapsedSeconds: 0 } },
      { x: -0.5, y: 0 }
    );

    const turned = run(rolling, GRAVITY_TURN_SECONDS);
    expect(turned.position.x).toBeGreaterThan(5);
    expectVector(currentGravity(turned), { x: 0, y: -1 });
  });

  it('keeps turning the pull while the ball rests, so a respawn eases back to the rest floor', () => {
    const flying = fly(shoot(level, ballAt({ x: 7, y: level.tee.y }), { x: 12, y: 0 }), 0.3);
    const destroyed: BallState = { ...flying, phase: 'destroyed' };

    const resting = respawn(destroyed);
    expect(resting.down).toEqual({ x: 0, y: -1 });
    expect(currentGravity(resting)).toEqual(currentGravity(flying));

    const later = step(level, resting, FIXED_STEP_SECONDS);
    expect(later.phase).toBe('aiming');
    expect(later.position).toEqual(resting.position);
    expect(currentGravity(later).y).toBeLessThan(currentGravity(resting).y);
  });

  it('settles somewhere after the hops and keeps that spot as the respawn point', () => {
    const state = fly(shoot(level, ballAt({ x: 2, y: 6 }), { x: -6, y: 0 }), 6);

    expect(state.phase).toBe('aiming');
    expect(state.rest.position).toEqual(state.position);
    expect(state.rest.down).toEqual(state.down);
    expect(state.position.x).toBeLessThan(4);
  });

  it('bounces off a 45° face without touching gravity', () => {
    const before = shoot(level, ballAt({ x: 5.25, y: 7.25 }), { x: 12, y: 12 });

    const after = fly(before, 0.15);

    expect(after.down).toEqual({ x: 0, y: -1 });
    expect(after.velocity.x).toBeLessThan(0);
  });

  it('never tunnels through a thin bar at full speed', () => {
    const state = fly(
      shoot(level, ballAt({ x: 2, y: 4 }), { x: MAX_SPEED_METERS_PER_SECOND, y: 0 }),
      0.2
    );

    expect(state.position.x).toBeLessThan(4);
    expect(state.velocity.x).toBeLessThan(0);
    expect(state.down).toEqual({ x: 1, y: 0 });
  });

  it('comes to rest on the floor and remembers the spot', () => {
    const state = fly(shoot(level, ballAt({ x: 2, y: 2 }), { x: 0.5, y: 0 }), 3);

    expect(state.phase).toBe('aiming');
    expect(state.position.y).toBeCloseTo(level.tee.y, 2);
    expect(state.rest.position).toEqual(state.position);
  });

  it('lets a slow ball roll into the cup and holes out only after a second in it', () => {
    const early = fly(shoot(level, ballAt({ x: 4, y: level.tee.y }), { x: 1.5, y: 0 }), 1.5);
    const settled = fly(shoot(level, ballAt({ x: 4, y: level.tee.y }), { x: 1.5, y: 0 }), 6);

    expect(early.phase).toBe('flying');
    expect(early.cupSeconds).toBeGreaterThan(0);
    expect(early.position.y).toBeLessThan(level.tee.y - BALL_RADIUS_METERS);
    expect(settled.phase).toBe('holed');
  });

  it('bounces a fast ball off the rim of the cup instead of catching it', () => {
    const fast = fly(shoot(level, ballAt({ x: 4.5, y: 3 }), { x: 0, y: -9 }), 0.4);

    expect(fast.phase).toBe('flying');
    expect(fast.cupSeconds).toBe(0);
    expect(fast.velocity.y).toBeGreaterThan(0);
  });
});
