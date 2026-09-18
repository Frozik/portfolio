import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall, respawn } from './ball';
import {
  BALL_RADIUS_METERS,
  FIXED_STEP_SECONDS,
  SPIKE_HEIGHT_METERS,
  SPIKE_WIDTH_METERS,
} from './constants';
import type { Level } from './level';
import { shoot } from './shot';
import { createSpikeRow, sweepCircleAgainstSpikes, toggleSpikes } from './spikes';
import { step } from './step';
import { createTestLevel } from './test-level';

const base = createTestLevel();
/** The floor's top face is wall 0, edge 2 and runs from x = 10 leftwards, so `from` counts from x = 10. */
const FLOOR_TOP: Readonly<{ wall: number; edge: number }> = { wall: 0, edge: 2 };
const FLOOR_Y = 1;
const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);

function withRows(
  rows: readonly { from: number; teeth: number; extendedAtStart: boolean }[]
): Level {
  return {
    ...base,
    spikes: rows.map(row =>
      createSpikeRow(
        base.walls[FLOOR_TOP.wall].edges[FLOOR_TOP.edge],
        row.from,
        row.teeth,
        row.extendedAtStart
      )
    ),
  };
}

function restingAt(level: Level, x: number): BallState {
  const position = { x, y: level.tee.y };
  return { ...createBall(level), position, rest: { position, down: { x: 0, y: -1 } } };
}

function fly(level: Level, ball: BallState, seconds: number): BallState {
  let state = ball;
  const steps = Math.round(seconds * SECOND_STEPS);
  for (let tick = 0; tick < steps && state.phase === 'flying'; tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

describe('createSpikeRow', () => {
  it('stands each tooth on the face a ball wide and two balls tall, sides facing out', () => {
    const [row] = withRows([{ from: 2, teeth: 2, extendedAtStart: true }]).spikes;

    expect(row.sides).toHaveLength(4);
    const [rise, fall, secondRise] = row.sides;
    expect(rise.from).toEqual({ x: 8, y: FLOOR_Y });
    expect(rise.to.x).toBeCloseTo(8 - SPIKE_WIDTH_METERS / 2);
    expect(rise.to.y).toBeCloseTo(FLOOR_Y + SPIKE_HEIGHT_METERS);
    expect(fall.to.x).toBeCloseTo(8 - SPIKE_WIDTH_METERS);
    expect(secondRise.from.x).toBeCloseTo(8 - SPIKE_WIDTH_METERS);
    expect(rise.normal.x).toBeGreaterThan(0);
    expect(rise.normal.y).toBeGreaterThan(0);
    expect(fall.normal.x).toBeLessThan(0);
    expect(fall.normal.y).toBeGreaterThan(0);
  });
});

describe('toggleSpikes', () => {
  const level = withRows([
    { from: 2, teeth: 1, extendedAtStart: true },
    { from: 4, teeth: 3, extendedAtStart: false },
  ]);

  it('flips every row the ball is clear of', () => {
    expect(toggleSpikes(level, [true, false], { x: 1, y: 5 })).toEqual([false, true]);
  });

  it('keeps a retracted row whose teeth would rise into the ball resting on it', () => {
    const overSecondRow: Vector2 = { x: 6 - SPIKE_WIDTH_METERS * 1.5, y: level.tee.y };

    expect(toggleSpikes(level, [true, false], overSecondRow)).toEqual([false, false]);
  });

  it('keeps the row while the ball lies against the edge of a tooth, not only over its middle', () => {
    const touchingLastTooth: Vector2 = { x: 6 - SPIKE_WIDTH_METERS * 3 - 0.05, y: level.tee.y };

    expect(toggleSpikes(level, [true, false], touchingLastTooth)).toEqual([false, false]);
  });

  it('still retracts a standing row the ball has come to rest right next to: sinking never hurts', () => {
    const besideFirstTooth: Vector2 = { x: 8 - SPIKE_WIDTH_METERS - 0.075, y: level.tee.y };

    expect(toggleSpikes(level, [true, false], besideFirstTooth)).toEqual([false, true]);
  });
});

describe('sweepCircleAgainstSpikes', () => {
  const level = withRows([{ from: 2, teeth: 1, extendedAtStart: true }]);

  it('finds the tooth the ball rolls into and ignores a retracted row', () => {
    const from = { x: 8.5, y: level.tee.y };
    const to = { x: 7.5, y: level.tee.y };

    const hit = sweepCircleAgainstSpikes(level, [true], from, to, BALL_RADIUS_METERS);
    expect(hit).toBeDefined();
    expect(hit?.time).toBeGreaterThan(0);
    expect(hit?.time).toBeLessThan(0.5);
    expect(sweepCircleAgainstSpikes(level, [false], from, to, BALL_RADIUS_METERS)).toBeUndefined();
  });
});

describe('spikes in play', () => {
  it('flip with the stroke before the ball moves', () => {
    const level = withRows([
      { from: 2, teeth: 1, extendedAtStart: true },
      { from: 5, teeth: 2, extendedAtStart: false },
    ]);
    const ball = restingAt(level, 2);
    expect(ball.spikes).toEqual([true, false]);

    const launched = shoot(level, ball, { x: 1, y: 3 });

    expect(launched.spikes).toEqual([false, true]);
  });

  it('destroy the ball that rolls into a standing tooth, right where it touches it', () => {
    const level = withRows([{ from: 2, teeth: 3, extendedAtStart: false }]);
    const launched = shoot(level, restingAt(level, 6), { x: 3, y: 0 });
    expect(launched.spikes).toEqual([true]);

    const state = fly(level, launched, 3);

    expect(state.phase).toBe('destroyed');
    expect(state.position.x).toBeLessThan(8 - 3 * SPIKE_WIDTH_METERS);
    expect(state.position.x).toBeGreaterThan(7);
  });

  it('let the ball roll over a retracted row as over plain floor', () => {
    const level = withRows([{ from: 2, teeth: 3, extendedAtStart: true }]);
    const launched = shoot(level, restingAt(level, 6), { x: 3, y: 0 });
    expect(launched.spikes).toEqual([false]);

    const state = fly(level, launched, 3);

    expect(state.phase).toBe('aiming');
    expect(state.position.x).toBeGreaterThan(8);
  });

  it('spare a ball flying past above the tips', () => {
    const level = withRows([{ from: 2, teeth: 3, extendedAtStart: false }]);
    const high = { ...restingAt(level, 6), position: { x: 6, y: FLOOR_Y + 0.6 } };

    const state = fly(level, shoot(level, high, { x: 10, y: 0 }), 0.25);

    expect(state.phase).toBe('flying');
    expect(state.position.x).toBeGreaterThan(8.2);
  });

  it('stay flipped after a destroyed ball respawns, so the tooth that killed it is down for the next stroke', () => {
    const level = withRows([{ from: 2, teeth: 3, extendedAtStart: false }]);
    const destroyed = fly(level, shoot(level, restingAt(level, 6), { x: 3, y: 0 }), 3);

    const back = respawn(destroyed);
    const next = shoot(level, back, { x: 3, y: 0 });

    expect(back.spikes).toEqual([true]);
    expect(next.spikes).toEqual([false]);
    expect(fly(level, next, 3).phase).toBe('aiming');
  });

  it('never rise into a ball resting on the row: it stays down for that stroke', () => {
    const level = withRows([{ from: 2, teeth: 3, extendedAtStart: false }]);
    const onRow = restingAt(level, 8 - SPIKE_WIDTH_METERS * 1.5);

    const launched = shoot(level, onRow, { x: 0.5, y: 0 });

    expect(launched.spikes).toEqual([false]);
    expect(fly(level, launched, 3).phase).toBe('aiming');
  });
});
