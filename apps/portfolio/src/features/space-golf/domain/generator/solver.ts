import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from '../ball';
import { createBall } from '../ball';
import { FIXED_STEP_SECONDS, MAX_SPEED_METERS_PER_SECOND } from '../constants';
import { cupCenter } from '../cup';
import type { Level } from '../level';
import { shoot } from '../shot';
import { step } from '../step';
import { distance } from '../vector';

const DIRECTIONS = 16;
const SPEEDS: readonly number[] = [
  MAX_SPEED_METERS_PER_SECOND / 4,
  MAX_SPEED_METERS_PER_SECOND / 2,
  MAX_SPEED_METERS_PER_SECOND,
];
/** A flight longer than this is not a stroke the solver counts on. */
const MAX_FLIGHT_SECONDS = 4;
export const MAX_SOLUTION_STROKES = 6;
/** Rest states the solver may expand before giving up on a level. */
const MAX_EXPANSIONS = 30;
/** Rest positions this close, with the same floor, are the same state. */
const STATE_CELL_METERS = 0.25;

export interface Solution {
  /** The launch velocities, one per stroke, from the tee to the cup. */
  readonly strokes: readonly Vector2[];
}

interface Node {
  readonly ball: BallState;
  readonly strokes: readonly Vector2[];
}

/**
 * Finds a way into the cup with the game's own physics: from every rest
 * state it tries a fan of strokes, keeps the ones that come to rest
 * somewhere new, and expands the rest state nearest the cup first. The
 * result is a proof the level is playable and its stroke count is the par.
 */
export function solve(level: Level): Solution | undefined {
  const target = cupCenter(level);
  const seen = new Set<string>([keyOf(createBall(level))]);
  const open: Node[] = [{ ball: createBall(level), strokes: [] }];
  let expansions = 0;

  while (open.length > 0 && expansions < MAX_EXPANSIONS) {
    open.sort((a, b) => distance(a.ball.position, target) - distance(b.ball.position, target));
    const node = open.shift();
    if (node === undefined || node.strokes.length >= MAX_SOLUTION_STROKES) {
      continue;
    }
    expansions += 1;
    for (const velocity of strokeFan()) {
      const landed = flyToRest(level, shoot(node.ball, velocity));
      const strokes = [...node.strokes, velocity];
      if (landed.phase === 'holed') {
        return { strokes };
      }
      if (landed.phase !== 'aiming') {
        continue;
      }
      const key = keyOf(landed);
      if (!seen.has(key)) {
        seen.add(key);
        open.push({ ball: landed, strokes });
      }
    }
  }
  return undefined;
}

/** Replays a solution; true when the last stroke drops the ball into the cup. */
export function replay(level: Level, solution: Solution): boolean {
  let ball = createBall(level);
  for (const velocity of solution.strokes) {
    ball = flyToRest(level, shoot(ball, velocity));
    if (ball.phase === 'holed') {
      return true;
    }
    if (ball.phase !== 'aiming') {
      return false;
    }
  }
  return false;
}

function* strokeFan(): Generator<Vector2> {
  for (let index = 0; index < DIRECTIONS; index += 1) {
    const angle = (index / DIRECTIONS) * 2 * Math.PI;
    for (const speed of SPEEDS) {
      yield { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    }
  }
}

function flyToRest(level: Level, launched: BallState): BallState {
  const maxSteps = Math.round(MAX_FLIGHT_SECONDS / FIXED_STEP_SECONDS);
  let ball = launched;
  for (let tick = 0; tick < maxSteps && ball.phase === 'flying'; tick += 1) {
    ball = step(level, ball, FIXED_STEP_SECONDS);
  }
  return ball;
}

function keyOf(ball: BallState): string {
  const x = Math.round(ball.position.x / STATE_CELL_METERS);
  const y = Math.round(ball.position.y / STATE_CELL_METERS);
  return `${x},${y},${ball.down.x},${ball.down.y}`;
}
