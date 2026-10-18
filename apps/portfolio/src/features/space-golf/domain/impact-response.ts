import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Impact } from './collision';
import {
  BOUNCE_RESTITUTION,
  CONTACT_FRICTION,
  ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND,
  FLOATER_RESTITUTION,
  MAX_SPEED_METERS_PER_SECOND,
  MIN_BOUNCE_SPEED_METERS_PER_SECOND,
  STICKY_CONTACT_FRICTION,
  STICKY_RESTITUTION,
  WALL_RESTITUTION,
} from './constants';
import type { FaceKind } from './level';
import { add, clampLength, dot, scale, subtract } from './vector';

const RESTITUTION: Readonly<Record<FaceKind, number>> = {
  floor: WALL_RESTITUTION,
  bounce: BOUNCE_RESTITUTION,
  sticky: STICKY_RESTITUTION,
  deflector: WALL_RESTITUTION,
  cup: WALL_RESTITUTION,
  floater: FLOATER_RESTITUTION,
  rod: FLOATER_RESTITUTION,
};

// An elastic or viscous band only coats an island's face, so its corners are
// the island's; a floater and a rod are one material through and through.
const CORNER_RESTITUTION: Readonly<Record<FaceKind, number>> = {
  ...RESTITUTION,
  bounce: WALL_RESTITUTION,
  sticky: WALL_RESTITUTION,
};

export interface Response {
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
export function respond(velocity: Vector2, hit: Impact, onRim: boolean): Response {
  const normalSpeed = dot(velocity, hit.normal);
  const tangential = subtract(velocity, scale(hit.normal, normalSpeed));
  const onFace = hit.at === 'face' && hit.kind !== 'deflector';
  const isFloor = (onFace && hit.kind !== 'floater' && hit.kind !== 'rod') || onRim;
  const minBounceSpeed =
    hit.kind === 'bounce'
      ? ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND
      : MIN_BOUNCE_SPEED_METERS_PER_SECOND;
  const bouncesBack = -normalSpeed >= minBounceSpeed;
  const restitution = (hit.at === 'corner' ? CORNER_RESTITUTION : RESTITUTION)[hit.kind];
  const reflected = bouncesBack ? -normalSpeed * restitution : 0;
  // Impact friction belongs to impacts: a ball rolling along its floor meets
  // the face every step and must keep its speed, the rolling resistance is its.
  const friction = hit.kind === 'sticky' ? STICKY_CONTACT_FRICTION : CONTACT_FRICTION;
  const kept = bouncesBack ? scale(tangential, friction) : tangential;
  const next = clampLength(add(kept, scale(hit.normal, reflected)), MAX_SPEED_METERS_PER_SECOND);
  return { velocity: next, becomesFloor: isFloor, resting: onFace && !bouncesBack };
}
