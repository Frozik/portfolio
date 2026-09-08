import type { Vector2 } from '@frozik/utils/math/vector2';

import type { EdgeRef, Level } from './level';
import { ZERO } from './vector';

type BallPhase = 'aiming' | 'flying' | 'destroyed' | 'holed';

/** Where and under which gravity the ball last came to rest — the respawn point. */
interface RestPoint {
  readonly position: Vector2;
  /** Unit vector: which way is down. */
  readonly down: Vector2;
}

export interface BallState {
  readonly position: Vector2;
  readonly velocity: Vector2;
  /** Unit vector: which way gravity pulls right now. */
  readonly down: Vector2;
  readonly phase: BallPhase;
  /** Strokes played on this level so far; spike rows read their state from its parity. */
  readonly stroke: number;
  readonly rest: RestPoint;
  /** The floor face the ball is in contact with, if any. */
  readonly contact: EdgeRef | undefined;
  /** How long the ball has been slow enough to count as coming to rest. */
  readonly settlingSeconds: number;
  /** How long the ball has been sitting in the cup; the hole counts after a second. */
  readonly cupSeconds: number;
  /** How long the ball has been outside the board; it bursts after a few seconds. */
  readonly offscreenSeconds: number;
  /** Indices into the level's pickups the ball has collected. */
  readonly collected: ReadonlySet<number>;
}

const DOWN: Vector2 = { x: 0, y: -1 };

export function createBall(level: Level): BallState {
  return {
    position: level.tee,
    velocity: ZERO,
    down: DOWN,
    phase: 'aiming',
    stroke: 0,
    rest: { position: level.tee, down: DOWN },
    contact: undefined,
    settlingSeconds: 0,
    cupSeconds: 0,
    offscreenSeconds: 0,
    collected: new Set(),
  };
}

/** A destroyed ball back at its last resting point, ready to be shot again; the stroke stays counted. */
export function respawn(ball: BallState): BallState {
  return {
    ...ball,
    position: ball.rest.position,
    velocity: ZERO,
    down: ball.rest.down,
    phase: 'aiming',
    contact: undefined,
    settlingSeconds: 0,
    cupSeconds: 0,
    offscreenSeconds: 0,
  };
}
