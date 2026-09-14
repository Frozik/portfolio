import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import type { WallHit } from './collision';
import { contactPosition, sweepCircleAgainstWalls } from './collision';
import {
  AIR_DAMPING_PER_SECOND,
  BALL_RADIUS_METERS,
  BOUNCE_RESTITUTION,
  CONTACT_EPSILON_METERS,
  CONTACT_FRICTION,
  CUP_HOLD_SECONDS,
  ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND,
  FIXED_STEP_SECONDS,
  GRAVITY_METERS_PER_SECOND_SQUARED,
  MAX_CONTACTS_PER_STEP,
  MAX_SPEED_METERS_PER_SECOND,
  MIN_BOUNCE_SPEED_METERS_PER_SECOND,
  OFFSCREEN_LIMIT_SECONDS,
  REST_SETTLE_SECONDS,
  REST_SPEED_METERS_PER_SECOND,
  ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED,
  STICKY_CONTACT_FRICTION,
  STICKY_RESTITUTION,
  STICKY_ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED,
  WALL_RESTITUTION,
} from './constants';
import { isInCup } from './cup';
import type { FaceKind, Level } from './level';
import { edgeOf, isBeyondBoard } from './level';
import { add, clampLength, dot, length, scale, subtract, ZERO } from './vector';

/**
 * One fixed step of the flight. Gravity is integrated, then the motion is
 * swept against every face; each contact is resolved in turn and the
 * remaining motion continues from it. The face rule lives here: a
 * horizontal or vertical face the ball touches becomes its floor, a diagonal
 * one only reflects, the hole's rim turns gravity into the face it is cut into. The
 * board is open: a ball that leaves it bursts the moment it does unless
 * gravity brings it back within a few seconds — the flight is deterministic,
 * so that is read off the flight itself.
 */
export function step(level: Level, ball: BallState, dt: number): BallState {
  if (ball.phase !== 'flying') {
    return ball;
  }

  let velocity = add(ball.velocity, scale(ball.down, GRAVITY_METERS_PER_SECOND_SQUARED * dt));
  let position = ball.position;
  let down = ball.down;
  let contact = ball.contact;
  let remaining = dt;

  for (let bounces = 0; bounces < MAX_CONTACTS_PER_STEP && remaining > 0; bounces += 1) {
    const target = add(position, scale(velocity, remaining));
    const wallHit = sweepCircleAgainstWalls(level, position, target, BALL_RADIUS_METERS);
    if (wallHit === undefined) {
      position = target;
      remaining = 0;
      break;
    }

    position = contactPosition(position, target, wallHit, CONTACT_EPSILON_METERS);
    const response = respond(velocity, wallHit);
    velocity = response.velocity;
    if (response.becomesFloor) {
      // The rim counts as the face the hole is cut into: gravity turns into
      // that face, so the ball settles on the bottom of the notch.
      const floorNormal = wallHit.kind === 'cup' ? edgeOf(level, level.cup).normal : wallHit.normal;
      down = scale(floorNormal, -1);
    }
    contact = response.resting ? { wall: wallHit.wall, edge: wallHit.edge } : undefined;
    remaining *= 1 - wallHit.time;
  }

  velocity =
    contact === undefined
      ? scale(velocity, Math.exp(-AIR_DAMPING_PER_SECOND * dt))
      : slowDown(velocity, rollingResistance(edgeOf(level, contact).kind) * dt);

  const beyond = isBeyondBoard(level, position, BALL_RADIUS_METERS);
  const offscreenSeconds = beyond ? ball.offscreenSeconds + dt : 0;
  if (offscreenSeconds >= OFFSCREEN_LIMIT_SECONDS) {
    return { ...ball, position, velocity: ZERO, phase: 'destroyed', contact: undefined };
  }
  const slow = contact !== undefined && length(velocity) < REST_SPEED_METERS_PER_SECOND;
  const settlingSeconds = slow ? ball.settlingSeconds + dt : 0;
  const next: BallState = {
    ...ball,
    position,
    velocity,
    down,
    contact,
    settlingSeconds,
    offscreenSeconds,
  };
  const justLeft = beyond && ball.offscreenSeconds === 0;
  if (justLeft && !comesBack(level, next)) {
    return { ...next, velocity: ZERO, phase: 'destroyed', contact: undefined };
  }

  // In the hole the ball lies on the rim like on any wall; only the clock
  // differs: it does not come to "rest" for the player — no stroke can be
  // played out of the cup — and after a second inside the level is holed.
  if (isInCup(level, next) && slow) {
    const cupSeconds = ball.cupSeconds + dt;
    const seated: BallState = { ...next, cupSeconds, settlingSeconds: 0 };
    return cupSeconds >= CUP_HOLD_SECONDS ? { ...seated, velocity: ZERO, phase: 'holed' } : seated;
  }
  if (next.cupSeconds > 0) {
    return { ...next, cupSeconds: 0 };
  }
  if (settlingSeconds >= REST_SETTLE_SECONDS) {
    if (beyond) {
      return { ...next, velocity: ZERO, phase: 'destroyed', contact: undefined };
    }
    return {
      ...next,
      velocity: ZERO,
      phase: 'aiming',
      settlingSeconds: 0,
      rest: { position, down },
    };
  }
  return next;
}

/** The velocity shortened by `amount`, down to a full stop. */
function slowDown(velocity: Vector2, amount: number): Vector2 {
  const speed = length(velocity);
  return speed <= amount ? ZERO : scale(velocity, (speed - amount) / speed);
}

function rollingResistance(kind: FaceKind): number {
  return kind === 'sticky'
    ? STICKY_ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED
    : ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED;
}

const RESTITUTION: Readonly<Record<FaceKind, number>> = {
  floor: WALL_RESTITUTION,
  bounce: BOUNCE_RESTITUTION,
  sticky: STICKY_RESTITUTION,
  deflector: WALL_RESTITUTION,
  cup: WALL_RESTITUTION,
};

interface Response {
  readonly velocity: Vector2;
  readonly becomesFloor: boolean;
  readonly resting: boolean;
}

/**
 * The velocity after a contact. The normal component is reflected with the
 * wall's restitution — or dropped when too slow to bounce, which is how the
 * ball comes to lie on a face — and the tangential one loses a share to
 * friction. Every axis-aligned face and every segment of the hole's rim
 * makes a floor; corners and diagonals reflect and leave gravity alone. An
 * elastic surface springs back even a soft touch, a viscous one swallows the
 * impact and grabs the ball along the face.
 */
function respond(velocity: Vector2, hit: WallHit): Response {
  const normalSpeed = dot(velocity, hit.normal);
  const tangential = subtract(velocity, scale(hit.normal, normalSpeed));
  const isFloor = hit.at === 'face' && hit.kind !== 'deflector';
  const minBounceSpeed =
    hit.kind === 'bounce'
      ? ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND
      : MIN_BOUNCE_SPEED_METERS_PER_SECOND;
  const bouncesBack = -normalSpeed >= minBounceSpeed;
  const restitution = hit.at === 'corner' ? WALL_RESTITUTION : RESTITUTION[hit.kind];
  const reflected = bouncesBack ? -normalSpeed * restitution : 0;
  // Impact friction belongs to impacts: a ball rolling along its floor meets
  // the face every step and must keep its speed, the rolling resistance is its.
  const friction = hit.kind === 'sticky' ? STICKY_CONTACT_FRICTION : CONTACT_FRICTION;
  const kept = bouncesBack ? scale(tangential, friction) : tangential;
  const next = clampLength(add(kept, scale(hit.normal, reflected)), MAX_SPEED_METERS_PER_SECOND);
  return { velocity: next, becomesFloor: isFloor, resting: isFloor && !bouncesBack };
}

/**
 * Whether a ball that has just left the board is back on it within the
 * off-screen limit: its flight is played ahead with the very same steps.
 * The look-ahead cannot recurse — the ball out there has left already, and
 * the first step that brings it back ends the search.
 */
function comesBack(level: Level, ball: BallState): boolean {
  const steps = Math.round(OFFSCREEN_LIMIT_SECONDS / FIXED_STEP_SECONDS);
  let ahead = ball;
  for (let tick = 0; tick < steps && ahead.phase === 'flying'; tick += 1) {
    ahead = step(level, ahead, FIXED_STEP_SECONDS);
    if (!isBeyondBoard(level, ahead.position, BALL_RADIUS_METERS)) {
      return true;
    }
  }
  return false;
}
