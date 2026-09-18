import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall, respawn } from './ball';
import {
  BALL_RADIUS_METERS,
  CONTACT_EPSILON_METERS,
  FIXED_STEP_SECONDS,
  FLOATER_LARGE_SIDE_METERS,
  GRIP_TOUCHES,
} from './constants';
import { createFloater } from './floaters';
import type { Level } from './level';
import { createRod, rodTipLength } from './rods';
import { shoot } from './shot';
import { createSpikeRow } from './spikes';
import { step } from './step';
import { createTestLevel } from './test-level';

const base = createTestLevel();
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);
const DOWN: Vector2 = { x: 0, y: -1 };
const RIGHT: Vector2 = { x: 1, y: 0 };
const BAR_LEFT_X = 4;
const CEILING_Y = 16;

function flying(level: Level, position: Vector2, velocity: Vector2, grip: number): BallState {
  return { ...createBall(level), phase: 'flying', position, velocity, grip };
}

function untilTouch(level: Level, ball: BallState, seconds = 2): BallState {
  let state = ball;
  for (
    let tick = 0;
    tick < seconds * SECOND_STEPS && state.phase === 'flying' && state.grip === ball.grip;
    tick += 1
  ) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

function run(level: Level, ball: BallState, seconds: number): BallState {
  let state = ball;
  for (let tick = 0; tick < Math.round(seconds * SECOND_STEPS); tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

describe('the grip', () => {
  it('is what the grip bonus gives: ten touches, at once', () => {
    const start = { ...createBall(base), position: { x: 2, y: 8 } };
    const withBonus: BallState = {
      ...start,
      bonus: { ...start.bonus, kind: 'grip', at: { x: 3, y: 8 }, strokesLeft: 3 },
    };

    const taken = run(base, shoot(base, withBonus, { x: 6, y: 0 }), 0.3);

    expect(taken.bonus.at).toBeUndefined();
    expect(taken.grip).toBe(GRIP_TOUCHES);
    expect(taken.foresight).toBe(0);
  });

  it('adds up: a grip bonus taken with touches still left gives ten more on top of them', () => {
    const start = { ...createBall(base), position: { x: 2, y: 8 }, grip: 4 };
    const withBonus: BallState = {
      ...start,
      bonus: { ...start.bonus, kind: 'grip', at: { x: 3, y: 8 }, strokesLeft: 3 },
    };

    const taken = run(base, shoot(base, withBonus, { x: 6, y: 0 }), 0.3);

    expect(taken.grip).toBe(4 + GRIP_TOUCHES);
  });

  it('sticks the ball where it touches a face of an island: at rest at once, no bounce, one touch spent, gravity turned as the face turns it', () => {
    const stuck = untilTouch(base, flying(base, { x: 3, y: 4 }, { x: 6, y: 1 }, 3));

    expect(stuck.phase).toBe('aiming');
    expect(stuck.grip).toBe(2);
    expect(stuck.velocity).toEqual({ x: 0, y: 0 });
    expect(stuck.position.x).toBeCloseTo(BAR_LEFT_X - BALL_RADIUS_METERS, 3);
    expect(stuck.position.y).toBeGreaterThan(4);
    expect(stuck.down).toEqual({ x: 1, y: 0 });
  });

  it('sticks to a 45° face too and stays there, gravity as it was', () => {
    // The chamfered block's cut corner runs from (6, 8.5) to (6.5, 8).
    const stuck = untilTouch(base, flying(base, { x: 5.6, y: 7.6 }, { x: 3, y: 3 }, 1));

    expect(stuck.phase).toBe('aiming');
    expect(stuck.grip).toBe(0);
    expect(stuck.down).toEqual(DOWN);

    const later = run(base, stuck, 2);
    expect(later.phase).toBe('aiming');
    expect(later.position).toEqual(stuck.position);
  });

  it('is spent by a touch that ends a flight, never by a rod nudging the stuck ball along the face it lies on', () => {
    const level: Level = {
      ...base,
      rods: [createRod('slide', { x: 0, y: 5 }, RIGHT, BAR_LEFT_X + rodTipLength('slide'))],
    };
    const againstTheBar = { x: BAR_LEFT_X - BALL_RADIUS_METERS - CONTACT_EPSILON_METERS, y: 5.01 };
    const stuck: BallState = {
      ...createBall(level),
      down: RIGHT,
      turn: { from: RIGHT, elapsedSeconds: 1 },
      position: againstTheBar,
      rest: { position: againstTheBar, down: RIGHT },
      rods: [3],
      grip: 41,
    };

    const nudged = run(level, stuck, 3);

    expect(nudged.position.y).not.toBeCloseTo(againstTheBar.y, 2);
    expect(nudged.grip).toBe(41);
  });

  it('lets a ball shot along the face it lies on roll: that is the same touch going on, not a new one', () => {
    const onTheFloor = { ...createBall(base), grip: 3 };

    const rolled = run(base, shoot(base, onTheFloor, { x: 2, y: 0 }), 0.2);

    expect(rolled.phase).toBe('flying');
    expect(rolled.position.x).toBeGreaterThan(onTheFloor.position.x + 0.2);
    expect(rolled.grip).toBe(3);
  });

  it('bounces as ever once the touches are spent', () => {
    const bounced = run(base, flying(base, { x: 3, y: 4 }, { x: 6, y: 1 }, 0), 0.3);

    expect(bounced.phase).toBe('flying');
    expect(bounced.velocity.x).toBeLessThan(0);
  });

  it('does not stick to floaters or rods, and spends nothing on them', () => {
    const center = { x: 2, y: 5 };
    const withFloater: Level = { ...base, floaters: [createFloater(center, 'square', true)] };
    const offFloater = run(
      withFloater,
      flying(
        withFloater,
        { x: center.x - FLOATER_LARGE_SIDE_METERS / 2 - 0.5, y: center.y },
        { x: 5, y: 0 },
        4
      ),
      0.2
    );
    expect(offFloater.phase).toBe('flying');
    expect(offFloater.grip).toBe(4);

    const withRod: Level = {
      ...base,
      rods: [createRod('screw', { x: 2, y: CEILING_Y }, DOWN, 3)],
    };
    const offRod = run(
      withRod,
      { ...flying(withRod, { x: 1, y: CEILING_Y - 1 }, { x: 5, y: 0 }, 4), rods: [3] },
      0.25
    );
    expect(offRod.phase).toBe('flying');
    expect(offRod.grip).toBe(4);
  });

  it('saves nobody from the spikes', () => {
    const level: Level = { ...base, spikes: [createSpikeRow(base.walls[0].edges[2], 7, 3, true)] };

    const fallen = run(level, flying(level, { x: 2.8, y: 2 }, { x: 0, y: -1 }, 5), 1);

    expect(fallen.phase).toBe('destroyed');
  });

  it('is lost with a burst ball', () => {
    expect(respawn({ ...createBall(base), grip: 6 }).grip).toBe(0);
  });
});
