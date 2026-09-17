import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState, Contact } from './ball';
import { advanceTurn, currentGravity, turnTo } from './ball';
import type { Impact, WallHit } from './collision';
import { contactPosition, earlierHit, sweepCircleAgainstWalls } from './collision';
import {
  AIR_DAMPING_PER_SECOND,
  BALL_RADIUS_METERS,
  BOUNCE_RESTITUTION,
  CONTACT_EPSILON_METERS,
  CONTACT_FRICTION,
  CUP_HOLD_SECONDS,
  ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND,
  FIXED_STEP_SECONDS,
  FLOATER_RESTITUTION,
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
import { isInCup, touchesRim } from './cup';
import type { FloaterHit } from './floaters';
import { sweepCircleAgainstFloaters } from './floaters';
import type { FaceKind, Level } from './level';
import { edgeOf, isBeyondBoard } from './level';
import type { RodHit } from './rods';
import { advanceRods, shoveOutOfRods, sweepCircleAgainstRods } from './rods';
import { sweepCircleAgainstSpikes } from './spikes';
import { isTouching } from './support';
import { add, clampLength, distance, dot, length, scale, subtract, ZERO } from './vector';

/**
 * One fixed step of the flight. Gravity is integrated, then the motion is
 * swept against every face; each contact is resolved in turn and the
 * remaining motion continues from it. The face rule lives here: a
 * horizontal or vertical face the ball touches becomes its floor, a diagonal
 * one only reflects, the hole's rim turns the floor into the face it is cut
 * into; a floater's or a rod's side reflects a touch more than a wall and
 * leaves gravity alone. The rods slide with gravity in every phase, and a
 * rod that slides into the ball shoves it aside — off its rest, if need be.
 * An extended spike tooth met before any wall destroys the ball where it
 * touches it. The board is open: a ball that leaves it bursts the moment
 * it does unless gravity brings it back within a few seconds — the flight is
 * deterministic, so that is read off the flight itself.
 */
export function step(level: Level, ball: BallState, dt: number): BallState {
  const turned = advanceTurn(ball, dt);
  const slid: BallState = { ...turned, rods: advanceRods(level, ball.rods, ball.down, dt) };
  if (ball.phase === 'holed' || ball.phase === 'destroyed') {
    return slid;
  }
  if (ball.phase === 'aiming') {
    return restingStep(level, slid);
  }

  let velocity = add(
    ball.velocity,
    scale(currentGravity(slid), GRAVITY_METERS_PER_SECOND_SQUARED * dt)
  );
  let position = ball.position;
  let floored = slid;
  let contact = ball.contact;
  let remaining = dt;

  for (let bounces = 0; bounces < MAX_CONTACTS_PER_STEP && remaining > 0; bounces += 1) {
    const target = add(position, scale(velocity, remaining));
    const hit = earlierHit(
      earlierHit(
        sweepCircleAgainstWalls(level.walls, position, target, BALL_RADIUS_METERS),
        sweepCircleAgainstFloaters(level, ball.floaters, position, target, BALL_RADIUS_METERS)
      ),
      sweepCircleAgainstRods(level, slid.rods, position, target, BALL_RADIUS_METERS)
    );
    const spikeHit = sweepCircleAgainstSpikes(
      level,
      ball.spikes,
      position,
      target,
      BALL_RADIUS_METERS
    );
    if (spikeHit !== undefined && (hit === undefined || spikeHit.time <= hit.time)) {
      return {
        ...floored,
        position: contactPosition(position, target, spikeHit, CONTACT_EPSILON_METERS),
        velocity: ZERO,
        phase: 'destroyed',
        contact: undefined,
      };
    }
    if (hit === undefined) {
      position = target;
      remaining = 0;
      break;
    }

    position = contactPosition(position, target, hit, CONTACT_EPSILON_METERS);
    const onRim = 'wall' in hit && touchesRim(level, hit, position);
    const response = respond(velocity, hit, onRim);
    velocity = response.velocity;
    if (response.becomesFloor) {
      // The rim counts as the face the hole is cut into: gravity turns into
      // that face, so the ball settles on the bottom of the notch.
      const floorNormal = onRim ? edgeOf(level, level.cup).normal : hit.normal;
      floored = floorTo(floored, scale(floorNormal, -1));
    }
    contact = response.resting ? contactOf(hit) : undefined;
    remaining *= 1 - hit.time;
  }

  velocity =
    contact === undefined
      ? scale(velocity, Math.exp(-AIR_DAMPING_PER_SECOND * dt))
      : slowDown(velocity, rollingResistance(contactKind(level, contact)) * dt);
  const shoved = shoveOutOfRods(level, slid.rods, floored.down, { position, velocity });
  if (shoved.position !== position) {
    ({ position, velocity } = shoved);
    contact = undefined;
  }

  const beyond = isBeyondBoard(level, position, BALL_RADIUS_METERS);
  const offscreenSeconds = beyond ? ball.offscreenSeconds + dt : 0;
  if (offscreenSeconds >= OFFSCREEN_LIMIT_SECONDS) {
    return { ...ball, position, velocity: ZERO, phase: 'destroyed', contact: undefined };
  }
  // Rest is read off the ground covered, not the velocity: a ball wedged
  // between two things gains speed from gravity every step yet goes
  // nowhere — that speed is phantom and is cut down to the ground covered,
  // and standing still against something is settling like rolling out is.
  const travelled = distance(position, ball.position);
  const still = travelled <= REST_SPEED_METERS_PER_SECOND * dt;
  const held = still && isTouching(level, { ...floored, position });
  if (held) {
    velocity = clampLength(velocity, travelled / dt);
  }
  const next: BallState = {
    ...floored,
    position,
    velocity,
    contact,
    settlingSeconds: 0,
    offscreenSeconds,
  };
  const settlingSeconds = held ? ball.settlingSeconds + dt : 0;
  const justLeft = beyond && ball.offscreenSeconds === 0;
  if (justLeft && !comesBack(level, next)) {
    return { ...next, velocity: ZERO, phase: 'destroyed', contact: undefined };
  }

  // In the hole the ball lies on the rim like on any wall; only the clock
  // differs: it does not come to "rest" for the player — no stroke can be
  // played out of the cup — and after a second inside the level is holed.
  if (isInCup(level, next) && held) {
    const cupSeconds = ball.cupSeconds + dt;
    const seated: BallState = { ...next, cupSeconds };
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
      rest: { position, down: next.down },
    };
  }
  return { ...next, settlingSeconds };
}

/**
 * A resting ball only watches the rods: one sliding into it shoves it off
 * its rest and into flight, and whatever held it sliding away — a rod from
 * under it, or from beside it where it was wedged — leaves it touching
 * nothing, so it falls.
 */
function restingStep(level: Level, ball: BallState): BallState {
  const shoved = shoveOutOfRods(level, ball.rods, ball.down, ball);
  if (shoved.position === ball.position && isTouching(level, ball)) {
    return ball;
  }
  return { ...ball, ...shoved, phase: 'flying', contact: undefined, settlingSeconds: 0 };
}

function contactOf(hit: WallHit | FloaterHit | RodHit): Contact {
  if ('wall' in hit) {
    return { wall: hit.wall, edge: hit.edge };
  }
  if ('floater' in hit) {
    return { floater: hit.floater, edge: hit.edge };
  }
  return { rod: hit.rod, edge: hit.edge };
}

function contactKind(level: Level, contact: Contact): FaceKind {
  if ('wall' in contact) {
    return edgeOf(level, contact).kind;
  }
  return 'floater' in contact ? 'floater' : 'rod';
}

// The floor the ball rolls along touches it every step: only a new floor restarts the turn.
function floorTo(ball: BallState, down: Vector2): BallState {
  return ball.down.x === down.x && ball.down.y === down.y ? ball : turnTo(ball, down);
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
  floater: FLOATER_RESTITUTION,
  rod: FLOATER_RESTITUTION,
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
 * makes a floor; corners and diagonals reflect and leave gravity alone, and
 * so does a floater's side, though the ball may come to lie on it — except
 * the hole's rim, which turns gravity wherever it is touched, between its
 * segments too, so a ball dropped in under sideways gravity settles. An
 * elastic surface springs back even a soft touch, a viscous one swallows the
 * impact and grabs the ball along the face.
 */
function respond(velocity: Vector2, hit: Impact, onRim: boolean): Response {
  const normalSpeed = dot(velocity, hit.normal);
  const tangential = subtract(velocity, scale(hit.normal, normalSpeed));
  const onFace = hit.at === 'face' && hit.kind !== 'deflector';
  const isFloor = (onFace && hit.kind !== 'floater' && hit.kind !== 'rod') || onRim;
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
  return { velocity: next, becomesFloor: isFloor, resting: onFace && !bouncesBack };
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
