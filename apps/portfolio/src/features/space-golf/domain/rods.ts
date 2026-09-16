import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Impact } from './collision';
import { distanceToSegment, sweepCircleAgainstWall } from './collision';
import {
  BALL_RADIUS_METERS,
  CONTACT_EPSILON_METERS,
  ROD_SEAT_DEPTH_METERS,
  ROD_SHOVE_CARRY_SHARE,
  ROD_SPEED_METERS_PER_SECOND,
  ROD_TIP_METERS,
  ROD_WIDTH_METERS,
} from './constants';
import type { FaceKind, Level, Rod, RodEdgeRef, Wall } from './level';
import { add, dot, rightNormal, scale, subtract, ZERO } from './vector';
import { containsPoint, createWall } from './walls';

export interface RodHit extends Impact, RodEdgeRef {}

const ROD_SIDES = 5;
/** The shortest body the outline keeps behind the tip's shoulder, so the polygon never folds. */
const SHAPE_MIN_BODY_METERS = CONTACT_EPSILON_METERS;

export function createRod(base: Vector2, direction: Vector2, length: number): Rod {
  return { base, direction, length };
}

/** Where the rod meets the face it bridges to: the face's point, not the tip's seat inside it. */
export function rodSeat(rod: Rod): Vector2 {
  return add(rod.base, scale(rod.direction, rod.length - ROD_SEAT_DEPTH_METERS));
}

export function initialRods(level: Level): readonly number[] {
  return level.rods.map(() => 0);
}

/** Whether gravity points the way the rod slides out: then it slides out, otherwise in. */
function slidesOut(rod: Rod, down: Vector2): boolean {
  return dot(rod.direction, down) > 0;
}

/** How far every rod stands out after `dt` more seconds under gravity pointing `down`. */
export function advanceRods(
  level: Level,
  extensions: readonly number[],
  down: Vector2,
  dt: number
): readonly number[] {
  return level.rods.map((rod, index) => {
    const travel = ROD_SPEED_METERS_PER_SECOND * dt;
    const next = extensions[index] + (slidesOut(rod, down) ? travel : -travel);
    return Math.min(Math.max(next, 0), rod.length);
  });
}

/** The rod's velocity as it slides, nothing while it stands at either end. */
function rodVelocity(rod: Rod, extension: number, down: Vector2): Vector2 {
  const out = slidesOut(rod, down);
  if ((out && extension >= rod.length) || (!out && extension <= 0)) {
    return ZERO;
  }
  return scale(rod.direction, out ? ROD_SPEED_METERS_PER_SECOND : -ROD_SPEED_METERS_PER_SECOND);
}

/**
 * The rod as a wall where it stands: the part out of its wall, a bar a
 * ball's diameter thick from the face it slides out of to a point half a
 * diameter long — the rest is inside the wall, where nothing can reach it,
 * and the wall may be thinner than the rod is long. Out less than the tip
 * is long, the shape is the whole tip, its shoulder just inside the face.
 * The tail runs counter-clockwise first, so the outline's orientation holds
 * whichever way the rod points.
 */
export function rodShape(rod: Rod, extension: number): Wall {
  const side = scale(rightNormal(rod.direction), ROD_WIDTH_METERS / 2);
  const out = Math.max(extension, ROD_TIP_METERS + SHAPE_MIN_BODY_METERS);
  const tip = add(rod.base, scale(rod.direction, out));
  const shoulder = subtract(tip, scale(rod.direction, ROD_TIP_METERS));
  const tail = subtract(tip, scale(rod.direction, out));
  const vertices = [
    subtract(tail, side),
    add(tail, side),
    add(shoulder, side),
    tip,
    subtract(shoulder, side),
  ];
  const kinds = new Map<number, FaceKind>();
  for (let index = 0; index < ROD_SIDES; index += 1) {
    kinds.set(index, 'rod');
  }
  return createWall(vertices, kinds);
}

/** The earliest rod, where it stands, the moving circle touches. */
export function sweepCircleAgainstRods(
  level: Level,
  extensions: readonly number[],
  from: Vector2,
  to: Vector2,
  radius: number
): RodHit | undefined {
  let best: RodHit | undefined;
  const { rods } = level;
  for (let index = 0; index < rods.length; index += 1) {
    if (extensions[index] <= 0) {
      continue;
    }
    const hit = sweepCircleAgainstWall(rodShape(rods[index], extensions[index]), from, to, radius);
    if (hit !== undefined && (best === undefined || hit.time < best.time)) {
      best = { ...hit, rod: index };
    }
  }
  return best;
}

/** A ball's motion as far as the rods are concerned. */
export interface Motion {
  readonly position: Vector2;
  readonly velocity: Vector2;
}

/**
 * The ball shoved clear of any rod that has slid into it: out along the
 * nearest side — off the pointed tip that is sideways — and carried at least
 * as fast as the rod moves. The same object back when no rod overlaps it.
 */
export function shoveOutOfRods(
  level: Level,
  extensions: readonly number[],
  down: Vector2,
  motion: Motion
): Motion {
  let shoved = motion;
  level.rods.forEach((rod, index) => {
    const extension = extensions[index];
    if (extension <= 0) {
      return;
    }
    const shape = rodShape(rod, extension);
    const nearest = nearestSide(shape, shoved.position);
    const inside = containsPoint(shape, shoved.position);
    const overlap = BALL_RADIUS_METERS - (inside ? -nearest.distance : nearest.distance);
    if (overlap <= 0) {
      return;
    }
    const { normal } = nearest;
    const position = add(shoved.position, scale(normal, overlap + CONTACT_EPSILON_METERS));
    const along = dot(shoved.velocity, normal);
    const carried = dot(rodVelocity(rod, extension, down), normal) * ROD_SHOVE_CARRY_SHARE;
    const velocity =
      along < carried ? add(shoved.velocity, scale(normal, carried - along)) : shoved.velocity;
    shoved = { position, velocity };
  });
  return shoved;
}

function nearestSide(shape: Wall, point: Vector2): { distance: number; normal: Vector2 } {
  let best = { distance: Number.POSITIVE_INFINITY, normal: shape.edges[0].normal };
  for (const edge of shape.edges) {
    const distance = distanceToSegment(point, edge);
    if (distance < best.distance) {
      best = { distance, normal: edge.normal };
    }
  }
  return best;
}
