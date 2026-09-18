import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall } from './ball';
import { bonusKindsFor, placeBonus } from './bonus';
import {
  BONUS_MAX_DISTANCE_METERS,
  BONUS_MIN_DISTANCE_METERS,
  FIXED_STEP_SECONDS,
  MAX_FORESIGHT,
  PREVIEW_DOT_COUNT,
  PREVIEW_INTERVAL_SECONDS,
} from './constants';
import { levelOf, startCourse } from './course';
import { previewPath } from './preview';
import { shoot } from './shot';
import { step } from './step';
import { createTestLevel } from './test-level';
import { containsPoint } from './walls';

const level = createTestLevel();
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);

function run(ball: BallState, seconds: number): BallState {
  let state = ball;
  for (let tick = 0; tick < Math.round(seconds * SECOND_STEPS); tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

function withBonusAt(ball: BallState, x: number, y: number, strokesLeft = 3): BallState {
  return { ...ball, bonus: { ...ball.bonus, kind: 'foresight', at: { x, y }, strokesLeft } };
}

describe('the bonus', () => {
  it('lies in the open near the ball on a new course: clear of every wall, a stroke or two away and never a journey', () => {
    for (const seed of [1, 2, 3]) {
      const { course, ball } = startCourse(seed, { widthCells: 24, heightCells: 24 });
      const spot = ball.bonus.at ?? { x: 0, y: 0 };
      const away = Math.hypot(spot.x - ball.position.x, spot.y - ball.position.y);

      expect(ball.bonus.at).toBeDefined();
      expect(levelOf(course).walls.some(wall => containsPoint(wall, spot))).toBe(false);
      expect(away).toBeGreaterThanOrEqual(BONUS_MIN_DISTANCE_METERS);
      expect(away).toBeLessThanOrEqual(BONUS_MAX_DISTANCE_METERS);
    }
  });

  it('is taken by a ball that flies through it, and the flight goes on as if nothing was there', () => {
    const start = { ...createBall(level), position: { x: 2, y: 8 } };
    const through = shoot(level, withBonusAt(start, 3, 8), { x: 6, y: 0 });
    const past = shoot(level, withBonusAt(start, 3, 12), { x: 6, y: 0 });

    const taken = run(through, 0.3);
    const missed = run(past, 0.3);

    expect(taken.bonus.at).toBeUndefined();
    expect(taken.foresight).toBe(1);
    expect(missed.bonus.at).toEqual({ x: 3, y: 12 });
    expect(missed.foresight).toBe(0);
    expect(taken.position).toEqual(missed.position);
    expect(taken.velocity).toEqual(missed.velocity);
  });

  it('never runs out: with foresight at its cap the disc still comes back, and from then on it is always the grip', () => {
    const start = {
      ...createBall(level),
      position: { x: 2, y: 8 },
      foresight: MAX_FORESIGHT - 1,
    };

    const taken = run(shoot(level, withBonusAt(start, 3, 8), { x: 6, y: 0 }), 0.3);
    expect(taken.foresight).toBe(MAX_FORESIGHT);

    let state = run(taken, 10);
    for (let move = 0; move < 6; move += 1) {
      expect(state.phase).toBe('aiming');
      expect(state.bonus.at).toBeDefined();
      expect(state.bonus.kind).toBe('grip');
      state = run(
        shoot(level, { ...state, bonus: { ...state.bonus, strokesLeft: 1 } }, { x: 0.5, y: 0 }),
        6
      );
    }
  });

  it('comes in both kinds while there is foresight left to gain', () => {
    const kinds = new Set<string>();
    for (let moves = 0; moves < 40; moves += 1) {
      kinds.add(placeBonus(level, moves, level.tee, bonusKindsFor(0)).kind);
    }

    expect([...kinds].sort()).toEqual(['foresight', 'grip']);
    expect(bonusKindsFor(MAX_FORESIGHT)).toEqual(['grip']);
  });

  it('counts strokes down and moves only once the ball has come to rest, to a new spot with a new count of one to three', () => {
    const resting = withBonusAt(createBall(level), 3, 12, 1);

    const launched = shoot(level, resting, { x: 0.5, y: 0 });
    expect(launched.bonus.strokesLeft).toBe(0);
    expect(run(launched, 0.1).bonus.at).toEqual({ x: 3, y: 12 });

    const settled = run(launched, 6);
    expect(settled.phase).toBe('aiming');
    expect(settled.bonus.at).toBeDefined();
    expect(settled.bonus.at).not.toEqual({ x: 3, y: 12 });
    expect(settled.bonus.strokesLeft).toBeGreaterThanOrEqual(1);
    expect(settled.bonus.strokesLeft).toBeLessThanOrEqual(3);
  });

  it('stays where it is while strokes are left, and comes back after it was taken once the ball rests', () => {
    const staying = run(
      shoot(level, withBonusAt(createBall(level), 3, 12, 3), { x: 0.5, y: 0 }),
      6
    );
    expect(staying.bonus.at).toEqual({ x: 3, y: 12 });
    expect(staying.bonus.strokesLeft).toBe(2);

    const start = { ...createBall(level), position: { x: 2, y: 8 } };
    const taken = run(shoot(level, withBonusAt(start, 3, 8), { x: 6, y: 0 }), 0.3);
    expect(taken.bonus.at).toBeUndefined();
    const back = run(taken, 10);
    expect(back.phase).toBe('aiming');
    expect(back.bonus.at).toBeDefined();
  });
});

describe('the preview with foresight', () => {
  const from = { x: 2, y: 8 };
  const velocity = { x: 4, y: 0 };

  it('is the straight impulse without the bonus, bends under gravity with it, and reaches further with every level', () => {
    const ball = { ...createBall(level), position: from };

    const plain = previewPath(level, ball, from, velocity);
    const bent = previewPath(level, { ...ball, foresight: 1 }, from, velocity);
    const longer = previewPath(level, { ...ball, foresight: 3 }, from, velocity);

    expect(plain).toHaveLength(PREVIEW_DOT_COUNT);
    expect(plain.every(dot => dot.y === from.y)).toBe(true);
    expect(bent).toHaveLength(PREVIEW_DOT_COUNT);
    expect(bent[bent.length - 1].y).toBeLessThan(from.y);
    expect(bent[0].x).toBeCloseTo(plain[0].x);
    expect(longer.length).toBeGreaterThan(bent.length);
  });

  it('lies on the very flight the stroke then takes: every dot is where the ball will be at that moment', () => {
    const ball = { ...createBall(level), position: from, foresight: MAX_FORESIGHT };
    const stroke = { x: 3, y: 5 };

    const dots = previewPath(level, ball, from, stroke);

    let flown = shoot(level, ball, stroke);
    const stepsPerDot = Math.round(PREVIEW_INTERVAL_SECONDS / FIXED_STEP_SECONDS);
    expect(dots.length).toBeGreaterThan(PREVIEW_DOT_COUNT);
    for (const dot of dots) {
      for (let tick = 0; tick < stepsPerDot; tick += 1) {
        flown = step(level, flown, FIXED_STEP_SECONDS);
      }
      expect(dot.x).toBeCloseTo(flown.position.x, 9);
      expect(dot.y).toBeCloseTo(flown.position.y, 9);
    }
  });

  it('stops at the first wall in its way', () => {
    const nearTheBar = { x: 3.6, y: 4 };
    const ball = { ...createBall(level), position: nearTheBar, foresight: 3 };

    const dots = previewPath(level, ball, nearTheBar, { x: 8, y: 0 });

    expect(dots.length).toBeLessThan(PREVIEW_DOT_COUNT);
    expect(dots.every(dot => dot.x < 4)).toBe(true);
  });
});
