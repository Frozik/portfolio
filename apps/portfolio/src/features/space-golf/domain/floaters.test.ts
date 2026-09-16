import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall } from './ball';
import {
  BALL_RADIUS_METERS,
  FIXED_STEP_SECONDS,
  FLOATER_LARGE_SIDE_METERS,
  FLOATER_SMALL_SIDE_METERS,
  WALL_RESTITUTION,
} from './constants';
import { createFloater, toggleFloaters } from './floaters';
import type { FloaterShape, Level } from './level';
import { shoot } from './shot';
import { step } from './step';
import { createTestLevel } from './test-level';

const base = createTestLevel();
const CENTER: Vector2 = { x: 2, y: 5 };
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);
const DOWN: Vector2 = { x: 0, y: -1 };

function withFloater(shape: FloaterShape, largeAtStart: boolean): Level {
  return { ...base, floaters: [createFloater(CENTER, shape, largeAtStart)] };
}

function flyingAt(level: Level, position: Vector2, velocity: Vector2): BallState {
  return { ...createBall(level), position, velocity, phase: 'flying' };
}

function fly(level: Level, ball: BallState, seconds: number): BallState {
  let state = ball;
  const steps = Math.round(seconds * SECOND_STEPS);
  for (let tick = 0; tick < steps && state.phase === 'flying'; tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

describe('createFloater', () => {
  it('lays out a small and a large square of floater faces, one and two ball diameters across', () => {
    const plain = createFloater(CENTER, 'square', false);

    expect(plain.small.bounds.max.x - plain.small.bounds.min.x).toBeCloseTo(
      FLOATER_SMALL_SIDE_METERS
    );
    expect(plain.large.bounds.max.y - plain.large.bounds.min.y).toBeCloseTo(
      FLOATER_LARGE_SIDE_METERS
    );
    expect(FLOATER_SMALL_SIDE_METERS).toBeCloseTo(2 * BALL_RADIUS_METERS);
    expect(FLOATER_LARGE_SIDE_METERS).toBeCloseTo(4 * BALL_RADIUS_METERS);
    expect(plain.small.edges.every(edge => edge.kind === 'floater')).toBe(true);
  });

  it('turns the square 45° with its corners on the axes, the sides diagonal yet still floater faces', () => {
    const turned = createFloater(CENTER, 'diamond', false);
    const halfDiagonal = (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;

    expect(turned.large.vertices[0]).toEqual({ x: CENTER.x, y: CENTER.y - halfDiagonal });
    expect(turned.large.edges.every(edge => edge.kind === 'floater')).toBe(true);
    expect(Math.abs(turned.large.edges[0].direction.x)).toBeCloseTo(Math.SQRT1_2);
  });

  it('rounds a circle of floater faces the same size across as the squares', () => {
    const round = createFloater(CENTER, 'circle', false);

    expect(round.large.vertices).toHaveLength(24);
    expect(round.large.bounds.max.x - round.large.bounds.min.x).toBeCloseTo(
      FLOATER_LARGE_SIDE_METERS
    );
    expect(round.small.edges.every(edge => edge.kind === 'floater')).toBe(true);
    for (const vertex of round.small.vertices) {
      expect(Math.hypot(vertex.x - CENTER.x, vertex.y - CENTER.y)).toBeCloseTo(
        FLOATER_SMALL_SIDE_METERS / 2
      );
    }
  });
});

describe('toggleFloaters', () => {
  const level = withFloater('square', false);

  it('flips a floater the ball is clear of', () => {
    expect(toggleFloaters(level, [false], { x: 6, y: 9 })).toEqual([true]);
    expect(toggleFloaters(level, [true], { x: 6, y: 9 })).toEqual([false]);
  });

  it('keeps a floater the ball is lying on', () => {
    const onTop = { x: CENTER.x, y: CENTER.y + FLOATER_SMALL_SIDE_METERS / 2 + BALL_RADIUS_METERS };

    expect(toggleFloaters(level, [false], onTop)).toEqual([false]);
  });

  it('keeps a small floater that would grow into the ball beside it', () => {
    const insideTheLargeShape = { x: CENTER.x + FLOATER_SMALL_SIDE_METERS / 2 + 0.1, y: CENTER.y };

    expect(toggleFloaters(level, [false], insideTheLargeShape)).toEqual([false]);
  });
});

describe('floaters in play', () => {
  it('flip with the stroke and stay put for a ball resting on one', () => {
    const level = withFloater('square', true);
    const clear = createBall(level);
    const onTop = {
      ...clear,
      position: {
        x: CENTER.x,
        y: CENTER.y + FLOATER_LARGE_SIDE_METERS / 2 + BALL_RADIUS_METERS,
      },
    };

    expect(shoot(level, clear, { x: 1, y: 1 }).floaters).toEqual([false]);
    expect(shoot(level, onTop, { x: 1, y: 1 }).floaters).toEqual([true]);
  });

  it('let the ball come to lie on top of a plain square without turning gravity', () => {
    const level = withFloater('square', false);
    const top = CENTER.y + FLOATER_SMALL_SIDE_METERS / 2;
    const dropped = flyingAt(level, { x: CENTER.x, y: top + 0.4 }, { x: 0, y: 0 });

    const state = fly(level, dropped, 5);

    expect(state.phase).toBe('aiming');
    expect(state.down).toEqual(DOWN);
    expect(state.position.y).toBeCloseTo(top + BALL_RADIUS_METERS, 2);
  });

  it('bounce the ball off a side more briskly than a wall would, gravity untouched', () => {
    const level = withFloater('square', true);
    const leftFace = CENTER.x - FLOATER_LARGE_SIDE_METERS / 2;
    const speed = 5;
    const start = { x: leftFace - 0.5, y: CENTER.y };

    const state = fly(level, flyingAt(level, start, { x: speed, y: 0 }), 0.2);

    expect(state.phase).toBe('flying');
    expect(state.down).toEqual(DOWN);
    expect(state.position.x).toBeLessThan(leftFace);
    expect(-state.velocity.x).toBeGreaterThan(speed * WALL_RESTITUTION);
  });

  it('deflect a falling ball sideways off a turned square, gravity untouched', () => {
    const level = withFloater('diamond', true);
    const apex = CENTER.y + (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;
    const offCentre = { x: CENTER.x + 0.1, y: apex + 0.5 };

    const state = fly(level, flyingAt(level, offCentre, { x: 0, y: -2 }), 0.5);

    expect(state.phase).toBe('flying');
    expect(state.down).toEqual(DOWN);
    expect(state.velocity.x).toBeGreaterThan(0.5);
  });

  it('roll a falling ball off the shoulder of a circle, gravity untouched', () => {
    const level = withFloater('circle', true);
    const top = CENTER.y + FLOATER_LARGE_SIDE_METERS / 2;
    const offCentre = { x: CENTER.x + 0.08, y: top + 0.5 };

    const state = fly(level, flyingAt(level, offCentre, { x: 0, y: -2 }), 0.6);

    expect(state.phase).toBe('flying');
    expect(state.down).toEqual(DOWN);
    expect(state.velocity.x).toBeGreaterThan(0.3);
  });
});
