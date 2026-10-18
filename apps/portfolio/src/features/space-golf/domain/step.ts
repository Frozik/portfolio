import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState, Contact } from './ball';
import { advanceTurn, currentGravity, turnTo } from './ball';
import { bonusKindsFor, isDue, isTaken, placeBonus } from './bonus';
import type { WallHit } from './collision';
import { contactPosition, earlierHit, sweepCircleAgainstWalls } from './collision';
import {
  AIR_DAMPING_PER_SECOND,
  BALL_RADIUS_METERS,
  CONTACT_EPSILON_METERS,
  CUP_HOLD_SECONDS,
  GRAVITY_METERS_PER_SECOND_SQUARED,
  MAX_AIRBORNE_SECONDS,
  MAX_CONTACTS_PER_STEP,
  MAX_FLIGHT_SECONDS,
  REST_SETTLE_SECONDS,
  REST_SPEED_METERS_PER_SECOND,
  ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED,
  STICKY_ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED,
  TERMINAL_SPEED_METERS_PER_SECOND,
} from './constants';
import { hasCup, isInCup, touchesRim } from './cup';
import type { FloaterHit } from './floaters';
import { sweepCircleAgainstFloaters } from './floaters';
import { respond } from './impact-response';
import type { FaceKind, Level } from './level';
import { edgeOf } from './level';
import { shoveOutOfRods } from './rod-shove';
import type { RodHit } from './rods';
import { advanceRods, sweepCircleAgainstRods } from './rods';
import { sweepCircleAgainstSpikes } from './spikes';
import { isSafeRest, isTouching } from './support';
import { withBonusTaken } from './take-bonus';
import { add, clampLength, distance, dot, length, scale, subtract, ZERO } from './vector';

/** The ball meeting a face or a corner: where on it, which way the face looks, what it is made of and how hard it was hit. */
export interface Touch {
  readonly point: Vector2;
  readonly normal: Vector2;
  readonly kind: FaceKind;
  readonly at: 'face' | 'corner';
  /** The ball's speed into the face, metres per second. */
  readonly speed: number;
}

/** The ball a step later, and every face it met on the way. */
export interface Stepped {
  readonly ball: BallState;
  readonly touches: readonly Touch[];
}

type Sweep =
  | { readonly outcome: 'destroyed'; readonly ball: BallState; readonly touches: readonly Touch[] }
  | {
      readonly outcome: 'moved';
      readonly ball: BallState;
      readonly position: Vector2;
      readonly velocity: Vector2;
      readonly contact: Contact | undefined;
      readonly touched: boolean;
      readonly isStuck: boolean;
      readonly touches: readonly Touch[];
    };

export function step(level: Level, ball: BallState, dt: number): BallState {
  return stepWithTouches(level, ball, dt).ball;
}

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
 * touches it. The course has no edge: nothing ends a flight but a wall, a
 * tooth or the cup, and no fall is faster than the terminal speed.
 */
export function stepWithTouches(level: Level, ball: BallState, dt: number): Stepped {
  const turned = advanceTurn(ball, dt);
  const slid: BallState = { ...turned, rods: advanceRods(level, ball.rods, ball.down, dt) };
  if (ball.phase === 'holed' || ball.phase === 'destroyed') {
    return { ball: slid, touches: [] };
  }
  if (ball.phase === 'aiming') {
    return { ball: restingStep(level, slid, ball.rods), touches: [] };
  }
  const sweep = sweepFlight(level, ball, slid, dt);
  if (sweep.outcome === 'destroyed') {
    return { ball: sweep.ball, touches: sweep.touches };
  }
  return { ball: settleFlight(level, ball, sweep, dt), touches: sweep.touches };
}

/** The motion of one step swept against every face, each contact resolved in turn. */
function sweepFlight(level: Level, ball: BallState, slid: BallState, dt: number): Sweep {
  let velocity = clampLength(
    add(ball.velocity, scale(currentGravity(slid), GRAVITY_METERS_PER_SECOND_SQUARED * dt)),
    TERMINAL_SPEED_METERS_PER_SECOND
  );
  let position = ball.position;
  let floored = slid;
  let contact = ball.contact;
  let remaining = dt;
  let touched = false;
  let isStuck = false;
  const touches: Touch[] = [];

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
        outcome: 'destroyed',
        ball: {
          ...floored,
          position: contactPosition(position, target, spikeHit, CONTACT_EPSILON_METERS),
          velocity: ZERO,
          phase: 'destroyed',
          contact: undefined,
        },
        touches,
      };
    }
    if (hit === undefined) {
      position = target;
      remaining = 0;
      break;
    }

    touched = true;
    position = contactPosition(position, target, hit, CONTACT_EPSILON_METERS);
    touches.push({
      point: subtract(position, scale(hit.normal, BALL_RADIUS_METERS)),
      normal: hit.normal,
      kind: hit.kind,
      at: hit.at,
      speed: Math.max(0, -dot(velocity, hit.normal)),
    });
    const onRim = 'wall' in hit && touchesRim(level, hit, position);
    const response = respond(velocity, hit, onRim);
    velocity = response.velocity;
    if (response.becomesFloor) {
      // The rim counts as the face the hole is cut into: gravity turns into
      // that face, so the ball settles on the bottom of the notch.
      const floorNormal = onRim && hasCup(level) ? edgeOf(level, level.cup).normal : hit.normal;
      floored = floorTo(floored, scale(floorNormal, -1));
    }
    if (
      ball.grip > 0 &&
      ball.airborneSeconds > 0 &&
      'wall' in hit &&
      !onRim &&
      edgeOf(level, hit).kind !== 'cup'
    ) {
      // The grip: the ball stays where it touched the island. Gravity has turned as the face
      // turns it, and the cup keeps its own rule — a ball held off its bottom would never hole out.
      // Only a touch that ends a free flight counts: a ball rolling along a face, or nudged along
      // it by a rod, is the same touch going on — it stuck anew every step and the rod burnt
      // through forty touches in a second.
      isStuck = true;
      velocity = ZERO;
      contact = contactOf(hit);
      break;
    }
    contact = response.resting ? contactOf(hit) : undefined;
    remaining *= 1 - hit.time;
  }
  return {
    outcome: 'moved',
    ball: floored,
    position,
    velocity,
    contact,
    touched,
    isStuck,
    touches,
  };
}

/** The swept ball slowed, shoved by the rods, and read for rest, the bonus, the cup and a flight that will not end. */
function settleFlight(
  level: Level,
  ball: BallState,
  sweep: Extract<Sweep, { readonly outcome: 'moved' }>,
  dt: number
): BallState {
  let { position, contact } = sweep;
  const { touched, isStuck } = sweep;
  let velocity =
    contact === undefined
      ? scale(sweep.velocity, Math.exp(-AIR_DAMPING_PER_SECOND * dt))
      : slowDown(sweep.velocity, rollingResistance(contactKind(level, contact)) * dt);
  const shove = shoveOutOfRods(
    level,
    { before: ball.rods, now: sweep.ball.rods },
    ball.floaters,
    sweep.ball.down,
    { position, velocity }
  );
  const floored: BallState = { ...sweep.ball, rods: shove.rods };
  if (shove.motion.position !== position) {
    ({ position, velocity } = shove.motion);
    contact = undefined;
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
  // The bonus is no obstacle: a ball that touched it on the way has it, and flies on.
  const hasBonus = isTaken(ball.bonus, ball.position, position);
  // A flight that will not end is ended here: nothing touched for too long is a fall with
  // no bottom, and too long since the stroke is a ball bouncing or circling for ever.
  const flightSeconds = ball.flightSeconds + dt;
  const airborneSeconds = touched ? 0 : ball.airborneSeconds + dt;
  if (flightSeconds >= MAX_FLIGHT_SECONDS || airborneSeconds >= MAX_AIRBORNE_SECONDS) {
    return { ...floored, position, velocity: ZERO, phase: 'destroyed', contact: undefined };
  }
  const grip = isStuck ? ball.grip - 1 : ball.grip;
  const next: BallState = {
    ...floored,
    position,
    velocity,
    flightSeconds,
    airborneSeconds,
    contact,
    settlingSeconds: 0,
    grip,
    ...(hasBonus ? withBonusTaken({ ...ball, grip }) : {}),
  };
  const settlingSeconds = restSeconds(ball.settlingSeconds + dt, held, isStuck);

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
    const rested: BallState = { ...next, velocity: ZERO, phase: 'aiming' };
    return isSafeRest(level, rested) ? { ...rested, rest: { position, down: next.down } } : rested;
  }
  return { ...next, settlingSeconds };
}

/**
 * A resting ball only watches the rods: one sliding into it shoves it off
 * its rest and into flight, and whatever held it sliding away — a rod from
 * under it, or from beside it where it was wedged — leaves it touching
 * nothing, so it falls.
 */
function restingStep(level: Level, resting: BallState, rodsBefore: readonly number[]): BallState {
  // The bonus moves only here, with the ball at rest, so the player sees where it is
  // before the stroke.
  const ball: BallState = isDue(resting.bonus)
    ? {
        ...resting,
        bonus: placeBonus(
          level,
          resting.bonus.moves + 1,
          resting.position,
          bonusKindsFor(resting.foresight)
        ),
      }
    : resting;
  const shove = shoveOutOfRods(
    level,
    { before: rodsBefore, now: ball.rods },
    ball.floaters,
    ball.down,
    { position: ball.position, velocity: ball.velocity }
  );
  const held: BallState = { ...ball, rods: shove.rods };
  if (shove.motion.position === ball.position && isTouching(level, held)) {
    return held;
  }
  return {
    ...held,
    ...shove.motion,
    phase: 'flying',
    contact: undefined,
    settlingSeconds: 0,
    flightSeconds: 0,
    airborneSeconds: 0,
  };
}

/** How long the ball has been settling: a stuck ball is at rest at once, a held one is getting there, any other starts over. */
function restSeconds(settling: number, held: boolean, isStuck: boolean): number {
  if (isStuck) {
    return REST_SETTLE_SECONDS;
  }
  return held ? settling : 0;
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
