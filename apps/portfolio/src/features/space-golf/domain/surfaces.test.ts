import { describe, expect, it } from 'vitest';

import type { BallState } from './ball';
import { createBall } from './ball';
import {
  BALL_RADIUS_METERS,
  BOARD_HEIGHT_METERS,
  BOARD_WIDTH_METERS,
  CONTACT_EPSILON_METERS,
  FIXED_STEP_SECONDS,
  CUP_RADIUS_METERS,
} from './constants';
import type { Level } from './level';
import { shoot } from './shot';
import { step } from './step';
import { applySurfaces } from './surfaces';
import { createBlock } from './walls';

const SECOND_STEPS = Math.round(1 / FIXED_STEP_SECONDS);
const FLOOR_TOP = 1;
const slab = createBlock(0, 0, BOARD_WIDTH_METERS, FLOOR_TOP);

/** The slab's top face is edge 2 and runs from x = 9 back to x = 0; a surface on x ∈ [2, 7]. */
function slabLevel(kind: 'bounce' | 'sticky'): Level {
  const [floor] = applySurfaces([slab], [{ wall: 0, edge: 2, from: 2, length: 5, kind }]);
  return {
    seed: 0,
    width: BOARD_WIDTH_METERS,
    height: BOARD_HEIGHT_METERS,
    walls: [floor],
    tee: { x: 4.5, y: FLOOR_TOP + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS },
    cup: { wall: 0, edge: 2, at: 0.5, radius: CUP_RADIUS_METERS },
    spikes: [],
    floaters: [],
    rods: [],
  };
}

function fly(level: Level, ball: BallState, seconds: number): BallState {
  let state = ball;
  for (let tick = 0; tick < seconds * SECOND_STEPS && state.phase === 'flying'; tick += 1) {
    state = step(level, state, FIXED_STEP_SECONDS);
  }
  return state;
}

function dropped(level: Level, height: number): BallState {
  return { ...createBall(level), phase: 'flying', position: { x: 4.5, y: FLOOR_TOP + height } };
}

describe('applySurfaces', () => {
  it('splits the face in three, the middle stretch carrying the surface and the rest staying floor', () => {
    const [floor] = applySurfaces(
      [slab],
      [{ wall: 0, edge: 2, from: 2, length: 5, kind: 'bounce' }]
    );

    expect(floor.vertices).toHaveLength(6);
    expect(floor.edges.map(edge => edge.kind)).toEqual([
      'floor',
      'floor',
      'floor',
      'bounce',
      'floor',
      'floor',
    ]);
    expect(floor.edges[3].from).toEqual({ x: 7, y: 1 });
    expect(floor.edges[3].to).toEqual({ x: 2, y: 1 });
  });
});

describe('an elastic surface', () => {
  it('hops the ball far longer than plain floor would, and still lets it lie still in the end', () => {
    const plain = slabLevel('sticky');
    const elastic = slabLevel('bounce');
    const plainFloor = { ...plain, walls: [slab] };

    const onPlain = fly(plainFloor, dropped(plainFloor, 1), 2.5);
    const onElastic = fly(elastic, dropped(elastic, 1), 2.5);
    const settled = fly(elastic, dropped(elastic, 1), 8);

    expect(onPlain.phase).toBe('aiming');
    expect(onElastic.phase).toBe('flying');
    expect(settled.phase).toBe('aiming');
    expect(settled.down).toEqual({ x: 0, y: -1 });
  });
});

describe('a viscous surface', () => {
  it('swallows the impact and holds the ball: it barely bounces and stops almost where it landed', () => {
    const viscous = slabLevel('sticky');
    const plainFloor = { ...viscous, walls: [slab] };
    const launch = { x: 3, y: -4 };

    const grabbed = fly(
      viscous,
      shoot(viscous, { ...createBall(viscous), position: { x: 3, y: 3 } }, launch),
      5
    );
    const rolled = fly(
      plainFloor,
      shoot(plainFloor, { ...createBall(plainFloor), position: { x: 3, y: 3 } }, launch),
      5
    );

    // Both land at x ≈ 4.1 after the same flight; only what follows differs.
    const LANDING_X = 4.1;
    expect(grabbed.phase).toBe('aiming');
    expect(rolled.phase).toBe('aiming');
    expect(grabbed.position.x).toBeLessThan(LANDING_X + 0.15);
    expect(rolled.position.x).toBeGreaterThan(LANDING_X + 1);
  });
});
