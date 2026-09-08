import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import type { SegmentHit, WallHit } from './collision';
import { contactPosition, sweepCircleAgainstSegment, sweepCircleAgainstWalls } from './collision';
import {
  AIR_DAMPING_PER_SECOND,
  BALL_RADIUS_METERS,
  BOUNCE_RESTITUTION,
  CONTACT_EPSILON_METERS,
  CONTACT_FRICTION,
  CUP_HOLD_SECONDS,
  DEFLECTOR_RESTITUTION,
  ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND,
  FLOOR_RESTITUTION,
  GRAVITY_METERS_PER_SECOND_SQUARED,
  MAX_CONTACTS_PER_STEP,
  MAX_SPEED_METERS_PER_SECOND,
  MIN_BOUNCE_SPEED_METERS_PER_SECOND,
  OFFSCREEN_LIMIT_SECONDS,
  REST_SETTLE_SECONDS,
  REST_SPEED_METERS_PER_SECOND,
  ROLLING_DAMPING_PER_SECOND,
} from './constants';
import { isInCup } from './cup';
import type { Level } from './level';
import { isBeyondBoard } from './level';
import { collectPickups } from './pickups';
import type { Hazard } from './spikes';
import { activeHazards } from './spikes';
import { add, clampLength, dot, length, scale, subtract, ZERO } from './vector';

const RESTITUTION = {
  floor: FLOOR_RESTITUTION,
  bounce: BOUNCE_RESTITUTION,
  deflector: DEFLECTOR_RESTITUTION,
  cup: FLOOR_RESTITUTION,
} as const;

/**
 * One fixed step of the flight. Gravity is integrated, then the motion is
 * swept against every face and spike; each contact is resolved in turn and
 * the remaining motion continues from it. The face rule lives here: a
 * horizontal or vertical face the ball touches becomes its floor, a diagonal
 * one only reflects, the hole's rim is a wall that leaves gravity alone, an
 * extended spike destroys the ball. The board is open: a ball that stays
 * beyond it for a few seconds, or comes to rest out there, bursts too.
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
  const hazards = activeHazards(level, ball.stroke);

  for (let bounces = 0; bounces < MAX_CONTACTS_PER_STEP && remaining > 0; bounces += 1) {
    const target = add(position, scale(velocity, remaining));
    const wallHit = sweepCircleAgainstWalls(level, position, target, BALL_RADIUS_METERS);
    const spikeHit = earliestHazardHit(position, target, hazards);

    if (spikeHit !== undefined && (wallHit === undefined || spikeHit.time <= wallHit.time)) {
      return {
        ...ball,
        position: contactPosition(position, target, spikeHit, CONTACT_EPSILON_METERS),
        velocity: ZERO,
        phase: 'destroyed',
        contact: undefined,
      };
    }
    if (wallHit === undefined) {
      position = target;
      remaining = 0;
      break;
    }

    position = contactPosition(position, target, wallHit, CONTACT_EPSILON_METERS);
    const response = respond(velocity, wallHit);
    velocity = response.velocity;
    if (response.becomesFloor) {
      down = scale(wallHit.normal, -1);
    }
    contact = response.resting ? { wall: wallHit.wall, edge: wallHit.edge } : undefined;
    remaining *= 1 - wallHit.time;
  }

  const damping = contact === undefined ? AIR_DAMPING_PER_SECOND : ROLLING_DAMPING_PER_SECOND;
  velocity = scale(velocity, Math.exp(-damping * dt));

  const beyond = isBeyondBoard(level, position, BALL_RADIUS_METERS);
  const offscreenSeconds = beyond ? ball.offscreenSeconds + dt : 0;
  if (offscreenSeconds >= OFFSCREEN_LIMIT_SECONDS) {
    return { ...ball, position, velocity: ZERO, phase: 'destroyed', contact: undefined };
  }
  const slow = contact !== undefined && length(velocity) < REST_SPEED_METERS_PER_SECOND;
  const settlingSeconds = slow ? ball.settlingSeconds + dt : 0;
  const next = collectPickups(level, {
    ...ball,
    position,
    velocity,
    down,
    contact,
    settlingSeconds,
    offscreenSeconds,
  });

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

interface Response {
  readonly velocity: Vector2;
  readonly becomesFloor: boolean;
  readonly resting: boolean;
}

/**
 * The velocity after a contact. The normal component is reflected with the
 * face's restitution — or dropped when too slow to bounce, which is how the
 * ball comes to lie on a face — and the tangential one loses a share to
 * friction. Only a flat axis-aligned face turns into the floor: corners,
 * diagonals and the hole's rim reflect and leave gravity alone; the rim, like
 * a floor, lets the ball come to rest on it.
 */
function respond(velocity: Vector2, hit: WallHit): Response {
  const normalSpeed = dot(velocity, hit.normal);
  const tangential = subtract(velocity, scale(hit.normal, normalSpeed));
  const isFlatFloor = hit.at === 'face' && (hit.kind === 'floor' || hit.kind === 'bounce');
  const canRest = isFlatFloor || (hit.at === 'face' && hit.kind === 'cup');
  const restitution = hit.at === 'corner' ? DEFLECTOR_RESTITUTION : RESTITUTION[hit.kind];
  const minBounceSpeed =
    hit.kind === 'bounce'
      ? ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND
      : MIN_BOUNCE_SPEED_METERS_PER_SECOND;
  const bouncesBack = -normalSpeed >= minBounceSpeed;
  const reflected = bouncesBack ? -normalSpeed * restitution : 0;
  // Impact friction belongs to impacts: a ball rolling along its floor meets
  // the face every step and must keep its speed, the rolling damping is its.
  const kept = bouncesBack ? scale(tangential, CONTACT_FRICTION) : tangential;
  const next = clampLength(add(kept, scale(hit.normal, reflected)), MAX_SPEED_METERS_PER_SECOND);
  return { velocity: next, becomesFloor: isFlatFloor, resting: canRest && !bouncesBack };
}

function earliestHazardHit(
  from: Vector2,
  to: Vector2,
  hazards: readonly Hazard[]
): SegmentHit | undefined {
  let best: SegmentHit | undefined;
  for (const hazard of hazards) {
    const hit = sweepCircleAgainstSegment(from, to, BALL_RADIUS_METERS, hazard);
    if (hit !== undefined && (best === undefined || hit.time < best.time)) {
      best = hit;
    }
  }
  return best;
}
