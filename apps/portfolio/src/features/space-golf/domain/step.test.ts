import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall } from './ball';
import { BALL_RADIUS_METERS, FIXED_STEP_SECONDS, MAX_SPEED_METERS_PER_SECOND } from './constants';
import { shoot } from './shot';
import { step } from './step';
import { createTestLevel } from './test-level';

const level = createTestLevel();
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);

function fly(ball: BallState, seconds: number): BallState {
  let state = ball;
  for (let tick = 0; tick < seconds * SECOND_STEPS; tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
    if (state.phase !== 'flying') {
      return state;
    }
  }
  return state;
}

function ballAt(position: Vector2, stroke = 0): BallState {
  return { ...createBall(level), position, rest: { position, down: { x: 0, y: -1 } }, stroke };
}

describe('step', () => {
  it('makes the vertical wall the floor when the ball hits it', () => {
    const state = fly(shoot(ballAt({ x: 7, y: 6 }), { x: 12, y: 0 }), 0.3);

    expect(state.down).toEqual({ x: 1, y: 0 });
    expect(state.velocity.x).toBeLessThan(0);
    expect(state.position.x).toBeLessThanOrEqual(level.width - BALL_RADIUS_METERS);
  });

  it('settles somewhere after the hops and keeps that spot as the respawn point', () => {
    const state = fly(shoot(ballAt({ x: 2, y: 6 }), { x: -12, y: 0 }), 6);

    expect(state.phase).toBe('aiming');
    expect(state.rest.position).toEqual(state.position);
    expect(state.rest.down).toEqual(state.down);
    expect(state.position.x).toBeLessThan(4);
  });

  it('bounces off a 45° face without touching gravity', () => {
    const before = shoot(ballAt({ x: 5.25, y: 7.25 }), { x: 12, y: 12 });

    const after = fly(before, 0.15);

    expect(after.down).toEqual({ x: 0, y: -1 });
    expect(after.velocity.x).toBeLessThan(0);
  });

  it('never tunnels through a thin bar at full speed', () => {
    const state = fly(shoot(ballAt({ x: 2, y: 4 }), { x: MAX_SPEED_METERS_PER_SECOND, y: 0 }), 0.2);

    expect(state.position.x).toBeLessThan(4);
    expect(state.velocity.x).toBeLessThan(0);
    expect(state.down).toEqual({ x: 1, y: 0 });
  });

  it('comes to rest on the floor and remembers the spot', () => {
    const state = fly(shoot(ballAt({ x: 2, y: 2 }), { x: 0.5, y: 0 }), 3);

    expect(state.phase).toBe('aiming');
    expect(state.position.y).toBeCloseTo(BALL_RADIUS_METERS, 2);
    expect(state.rest.position).toEqual(state.position);
  });

  it('lets a slow ball roll into the cup and holes out only after a second in it', () => {
    const early = fly(shoot(ballAt({ x: 3.5, y: level.tee.y }), { x: 1.5, y: 0 }), 1.5);
    const settled = fly(shoot(ballAt({ x: 3.5, y: level.tee.y }), { x: 1.5, y: 0 }), 6);

    expect(early.phase).toBe('flying');
    expect(early.cupSeconds).toBeGreaterThan(0);
    expect(early.position.y).toBeLessThan(0);
    expect(settled.phase).toBe('holed');
  });

  it('bounces a fast ball off the rim of the cup instead of catching it', () => {
    const fast = fly(shoot(ballAt({ x: 4.5, y: 3 }), { x: 0, y: -9 }), 0.4);

    expect(fast.phase).toBe('flying');
    expect(fast.cupSeconds).toBe(0);
    expect(fast.velocity.y).toBeGreaterThan(0);
  });

  it('destroys the ball on an extended spike row and spares it when the row is retracted', () => {
    const onOddStroke = fly(shoot(ballAt({ x: 8.5, y: 3 }), { x: 0, y: -1 }), 4);
    const onEvenStroke = fly(shoot(ballAt({ x: 8.5, y: 3 }, 1), { x: 0, y: -1 }), 4);

    expect(onOddStroke.phase).toBe('destroyed');
    expect(onOddStroke.stroke).toBe(1);
    expect(onEvenStroke.phase).toBe('aiming');
    expect(onEvenStroke.position.y).toBeCloseTo(BALL_RADIUS_METERS, 2);
  });
});
