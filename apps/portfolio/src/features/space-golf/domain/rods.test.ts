import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall } from './ball';
import {
  BALL_RADIUS_METERS,
  CONTACT_EPSILON_METERS,
  FIXED_STEP_SECONDS,
  ROD_SPEED_METERS_PER_SECOND,
  ROD_TIP_METERS,
  ROD_WIDTH_METERS,
  WALL_RESTITUTION,
} from './constants';
import type { Level } from './level';
import { advanceRods, createRod, rodShape } from './rods';
import { step } from './step';
import { createTestLevel } from './test-level';
import { createChamferedBlock } from './walls';

const base = createTestLevel();
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);
const DOWN: Vector2 = { x: 0, y: -1 };
const RIGHT: Vector2 = { x: 1, y: 0 };
const CEILING_Y = 16;
const LEFT_WALL_X = 0;

/** The thin bar of the test level stands at x = 4..4.1, y = 2..6. */
const BAR_LEFT_X = 4;
const BAR_RIGHT_X = 4.1;
const BAR_TOP_Y = 6;

/** A rod hanging from the ceiling at x = 2, and one sliding out of the left wall at y = 5 to seat in the bar. */
function withRods(): Level {
  return {
    ...base,
    rods: [
      createRod({ x: 2, y: CEILING_Y }, DOWN, 2),
      createRod({ x: LEFT_WALL_X, y: 5 }, RIGHT, BAR_LEFT_X - LEFT_WALL_X + ROD_TIP_METERS),
    ],
  };
}

function run(level: Level, ball: BallState, seconds: number): BallState {
  let state = ball;
  const steps = Math.round(seconds * SECOND_STEPS);
  for (let tick = 0; tick < steps; tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

function runUntil(
  level: Level,
  ball: BallState,
  seconds: number,
  done: (state: BallState) => boolean
): BallState {
  let state = ball;
  const steps = Math.round(seconds * SECOND_STEPS);
  for (let tick = 0; tick < steps && !done(state); tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

describe('rodShape', () => {
  it('is a bar a ball thick from the face to a point, only the part out of the wall — the wall may be thinner than the rod is long', () => {
    const [hanging] = withRods().rods;
    const shape = rodShape(hanging, 0.5);

    expect(shape.vertices).toHaveLength(5);
    expect(shape.vertices[3]).toEqual({ x: 2, y: CEILING_Y - 0.5 });
    expect(shape.bounds.max.x - shape.bounds.min.x).toBeCloseTo(ROD_WIDTH_METERS);
    expect(shape.bounds.max.y).toBeCloseTo(CEILING_Y);
    expect(shape.bounds.min.y).toBeCloseTo(CEILING_Y - 0.5);
    expect(shape.edges.every(edge => edge.kind === 'rod')).toBe(true);
    expect(ROD_TIP_METERS).toBeCloseTo(BALL_RADIUS_METERS);
  });

  it('folds as it slides in: nothing of it stands behind the face, however thin the wall', () => {
    // The thin bar at x = 4..4.1 is far thinner than the rod is long.
    const level: Level = {
      ...base,
      rods: [createRod({ x: 4.1, y: 4 }, RIGHT, 2)],
    };
    const towardsTheBar: BallState = {
      ...createBall(level),
      phase: 'flying',
      rods: [1],
      position: { x: 2, y: 4 },
      velocity: { x: 5, y: 0 },
    };

    const reached = runUntil(level, towardsTheBar, 0.5, state => state.position.x >= 3.8);

    // A tail behind the face would have stopped the ball a metre short of the bar.
    expect(reached.position.x).toBeGreaterThanOrEqual(3.8);
  });
});

describe('advanceRods', () => {
  const level = withRods();

  it('slides a rod out while gravity points its way and in otherwise, at one speed', () => {
    const ball = createBall(level);
    const dt = 0.1;

    const out = advanceRods(level, [1, 1], ball.down, dt);

    expect(out[0]).toBeCloseTo(1 + ROD_SPEED_METERS_PER_SECOND * dt);
    expect(out[1]).toBeCloseTo(1 - ROD_SPEED_METERS_PER_SECOND * dt);
  });

  it('stops at either end', () => {
    const ball = createBall(level);

    expect(advanceRods(level, [2, 0], ball.down, 1)).toEqual([2, 0]);
  });
});

describe('rods in play', () => {
  it('start fully in and slide out under the starting gravity while the ball still rests on the tee', () => {
    const level = withRods();
    const ball = createBall(level);
    expect(ball.rods).toEqual([0, 0]);

    const later = run(level, ball, 1.5);

    expect(later.phase).toBe('aiming');
    expect(later.rods[0]).toBe(2);
    expect(later.rods[1]).toBe(0);
  });

  it('bounce the ball off a standing rod more briskly than a wall, gravity untouched', () => {
    const level = withRods();
    const speed = 5;
    const flying: BallState = {
      ...createBall(level),
      phase: 'flying',
      rods: [2, 0],
      position: { x: 1, y: CEILING_Y - 1 },
      velocity: { x: speed, y: 0 },
    };

    const state = run(level, flying, 0.25);

    expect(state.phase).toBe('flying');
    expect(state.down).toEqual(DOWN);
    expect(state.position.x).toBeLessThan(2 - ROD_WIDTH_METERS / 2);
    expect(-state.velocity.x).toBeGreaterThan(speed * WALL_RESTITUTION);
  });

  it('shove a resting ball aside with the pointed tip and set it flying', () => {
    const level = withRods();
    const againstTheBar = { x: BAR_LEFT_X - BALL_RADIUS_METERS - CONTACT_EPSILON_METERS, y: 5 };
    const inTheWay: BallState = {
      ...createBall(level),
      down: RIGHT,
      turn: { from: RIGHT, elapsedSeconds: 1 },
      position: againstTheBar,
      rest: { position: againstTheBar, down: RIGHT },
      rods: [0, 0.5],
    };

    const secondsToCross = BAR_LEFT_X / ROD_SPEED_METERS_PER_SECOND;
    const shoved = runUntil(level, inTheWay, secondsToCross, state => state.phase !== 'aiming');

    expect(shoved.phase).toBe('flying');
    expect(Math.abs(shoved.position.y - 5)).toBeGreaterThan(0);
    expect(shoved.rods[1]).toBeGreaterThan(0.5);
    // Nudged, not kicked: well under the rod's own speed.
    expect(Math.hypot(shoved.velocity.x, shoved.velocity.y)).toBeLessThan(
      ROD_SPEED_METERS_PER_SECOND / 2
    );
  });

  it('drop a ball resting on a rod once the rod has slid out from under it', () => {
    const level = withRods();
    const top = 5 + ROD_WIDTH_METERS / 2;
    const onRod: BallState = {
      ...createBall(level),
      position: { x: 1.5, y: top + BALL_RADIUS_METERS },
      rest: { position: { x: 1.5, y: top + BALL_RADIUS_METERS }, down: DOWN },
      contact: { rod: 1, edge: 4 },
      rods: [0, 3],
    };

    const dropped = runUntil(level, onRod, 2, state => state.phase !== 'aiming');
    expect(dropped.phase).toBe('flying');
    // The support goes the moment the shoulder of the tip slides past the ball.
    expect(dropped.rods[1]).toBeLessThan(1.5 + ROD_TIP_METERS);
    expect(dropped.rods[1]).toBeGreaterThan(1.5 - ROD_TIP_METERS);

    const fallen = run(level, dropped, 1);
    expect(fallen.position.y).toBeLessThan(top);
  });

  it('let the ball come to rest wedged between a standing rod and a corner — at rest is at rest, however it got there', () => {
    // A rod hangs just right of the bar's top-right corner; the ball leans on the corner and the rod.
    const gap = 0.02;
    const rodX = BAR_RIGHT_X + BALL_RADIUS_METERS + ROD_WIDTH_METERS / 2 + gap;
    const level: Level = { ...base, rods: [createRod({ x: rodX, y: CEILING_Y }, DOWN, 12)] };
    const leaning = {
      x: rodX - ROD_WIDTH_METERS / 2 - BALL_RADIUS_METERS,
      y: BAR_TOP_Y + Math.sqrt(BALL_RADIUS_METERS ** 2 - gap ** 2),
    };
    const wedged: BallState = {
      ...createBall(level),
      phase: 'flying',
      rods: [12],
      position: leaning,
    };

    const state = runUntil(level, wedged, 3, each => each.phase !== 'flying');

    expect(state.phase).toBe('aiming');
    expect(state.position.y).toBeGreaterThan(BAR_TOP_Y);
    expect(state.position.y).toBeLessThan(BAR_TOP_Y + 2 * BALL_RADIUS_METERS);
  });

  it("let the ball come to rest wedged between a standing rod and an island's chamfered corner", () => {
    // An island whose top-right corner is cut at 45°, a rod hanging a ball's width past its end.
    const shelf = createChamferedBlock(1, 8, 3, 1, 0.1, new Set(['upperRight']));
    const rodX = 4 + 2 * BALL_RADIUS_METERS + ROD_WIDTH_METERS / 2;
    const level: Level = {
      ...base,
      walls: [...base.walls, shelf],
      rods: [createRod({ x: rodX, y: CEILING_Y }, DOWN, 12)],
    };
    const dropped: BallState = {
      ...createBall(level),
      phase: 'flying',
      rods: [12],
      position: { x: rodX - ROD_WIDTH_METERS / 2 - BALL_RADIUS_METERS - 0.01, y: 9.6 },
    };

    const state = runUntil(level, dropped, 4, each => each.phase !== 'flying');

    expect(state.phase).toBe('aiming');
    expect(state.position.y).toBeGreaterThan(8.9);
    expect(state.position.y).toBeLessThan(9.1);
  });
});
