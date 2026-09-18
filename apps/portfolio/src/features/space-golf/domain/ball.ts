import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BonusState } from './bonus';
import { placeBonus } from './bonus';
import { GRAVITY_TURN_SECONDS } from './constants';
import { initialFloaters } from './floaters';
import type { EdgeRef, FloaterEdgeRef, Level, RodEdgeRef } from './level';
import { initialRods } from './rods';
import { initialSpikes } from './spikes';
import { lerp, ZERO } from './vector';

type BallPhase = 'aiming' | 'flying' | 'destroyed' | 'holed';

/** What the ball lies on: a face of a wall, a side of a floater in its current shape, or a side of a rod where it stands. */
export type Contact = EdgeRef | FloaterEdgeRef | RodEdgeRef;

interface GravityTurn {
  readonly from: Vector2;
  readonly elapsedSeconds: number;
}

/** Where and under which gravity the ball last came to rest — the respawn point. */
interface RestPoint {
  readonly position: Vector2;
  /** Unit vector: which way is down. */
  readonly down: Vector2;
}

export interface BallState {
  readonly position: Vector2;
  readonly velocity: Vector2;
  /** Unit vector: the floor's direction. */
  readonly down: Vector2;
  readonly turn: GravityTurn;
  readonly phase: BallPhase;
  /** Strokes played on this level so far. */
  readonly stroke: number;
  readonly rest: RestPoint;
  /** The face the ball is in contact with, if any. */
  readonly contact: Contact | undefined;
  /** How long the ball has been slow enough to count as coming to rest. */
  readonly settlingSeconds: number;
  /** How long the ball has been sitting in the cup; the hole counts after a second. */
  readonly cupSeconds: number;
  /** How long this flight has lasted; past the limit it is ended. */
  readonly flightSeconds: number;
  /** How long the flying ball has touched nothing; past the limit it is falling for ever. */
  readonly airborneSeconds: number;
  /** Which spike rows stand extended, by row index; the rows flip with every stroke. */
  readonly spikes: readonly boolean[];
  /** Which floaters are large, by floater index; they flip with every stroke. */
  readonly floaters: readonly boolean[];
  /** How far each rod stands out of its wall, metres, by rod index; they slide with gravity. */
  readonly rods: readonly number[];
  readonly bonus: BonusState;
  /** Bonuses taken on this level, capped: what the preview knows of the flight ahead. */
  readonly foresight: number;
}

const DOWN: Vector2 = { x: 0, y: -1 };

export function createBall(level: Level): BallState {
  return {
    position: level.tee,
    velocity: ZERO,
    down: DOWN,
    turn: settledTurn(DOWN),
    phase: 'aiming',
    stroke: 0,
    rest: { position: level.tee, down: DOWN },
    contact: undefined,
    settlingSeconds: 0,
    cupSeconds: 0,
    flightSeconds: 0,
    airborneSeconds: 0,
    spikes: initialSpikes(level),
    floaters: initialFloaters(level),
    rods: initialRods(level),
    bonus: placeBonus(level, 0, level.tee),
    foresight: 0,
  };
}

export function currentGravity(ball: BallState): Vector2 {
  const time = Math.min(ball.turn.elapsedSeconds / GRAVITY_TURN_SECONDS, 1);
  return lerp(ball.turn.from, ball.down, easeOut(time));
}

function easeOut(time: number): number {
  return 1 - (1 - time) ** 2;
}

function settledTurn(down: Vector2): GravityTurn {
  return { from: down, elapsedSeconds: GRAVITY_TURN_SECONDS };
}

export function turnTo(ball: BallState, down: Vector2): BallState {
  return { ...ball, down, turn: { from: currentGravity(ball), elapsedSeconds: 0 } };
}

export function advanceTurn(ball: BallState, dt: number): BallState {
  const elapsedSeconds = Math.min(ball.turn.elapsedSeconds + dt, GRAVITY_TURN_SECONDS);
  return { ...ball, turn: { ...ball.turn, elapsedSeconds } };
}

/** A destroyed ball back at its last resting point, ready to be shot again; the stroke stays counted, and the foresight the bonuses gave is gone with the ball that earned it. */
export function respawn(ball: BallState): BallState {
  return {
    ...turnTo(ball, ball.rest.down),
    position: ball.rest.position,
    velocity: ZERO,
    phase: 'aiming',
    contact: undefined,
    settlingSeconds: 0,
    cupSeconds: 0,
    flightSeconds: 0,
    airborneSeconds: 0,
    foresight: 0,
  };
}
