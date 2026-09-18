import type { Vector2 } from '@frozik/utils/math/vector2';

import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Impact } from './collision';
import { sweepCircleAgainstWall } from './collision';

import {
  CONTACT_EPSILON_METERS,
  ROD_SPEED_METERS_PER_SECOND,
  ROD_WIDTH_METERS,
  SCREW_WIDTH_FACTOR,
} from './constants';
import type { FaceKind, Level, Rod, RodEdgeRef, RodKind, Wall } from './level';
import { add, distance, dot, rightNormal, scale, subtract, ZERO } from './vector';
import { createWall } from './walls';

export interface RodHit extends Impact, RodEdgeRef {}

const ROD_SIDES = 5;
/** The shortest body the outline keeps behind the tip's shoulder, so the polygon never folds. */
const SHAPE_MIN_BODY_METERS = CONTACT_EPSILON_METERS;

export function createRod(kind: RodKind, base: Vector2, direction: Vector2, length: number): Rod {
  return { kind, base, direction, length };
}

export function rodWidth(kind: RodKind): number {
  switch (kind) {
    case 'slide':
      return ROD_WIDTH_METERS;
    case 'screw':
      return ROD_WIDTH_METERS * SCREW_WIDTH_FACTOR;
    default:
      return assertNever(kind);
  }
}

/** The pointed tip is half the rod's width long — a right-angled point — and sinks its own length into the far face. */
export function rodTipLength(kind: RodKind): number {
  return rodWidth(kind) / 2;
}

/** Where the rod meets the face it bridges to: the face's point, not the tip's seat inside it. */
export function rodSeat(rod: Rod): Vector2 {
  return add(rod.base, scale(rod.direction, rod.length - rodTipLength(rod.kind)));
}

export function initialRods(level: Level): readonly number[] {
  return level.rods.map(() => 0);
}

/**
 * Which way the rod moves under gravity pointing `down`: +1 out, -1 in, 0
 * standing. A sliding rod goes out while gravity points its way and in
 * otherwise; a screw rod goes in only while gravity points the other way
 * and holds while gravity is across it.
 */
function drive(rod: Rod, down: Vector2): number {
  const along = dot(rod.direction, down);
  switch (rod.kind) {
    case 'slide':
      return along > 0 ? 1 : -1;
    case 'screw':
      return Math.sign(along);
    default:
      return assertNever(rod.kind);
  }
}

/** How far every rod stands out after `dt` more seconds under gravity pointing `down`. */
export function advanceRods(
  level: Level,
  extensions: readonly number[],
  down: Vector2,
  dt: number
): readonly number[] {
  return level.rods.map((rod, index) => {
    const next = extensions[index] + drive(rod, down) * ROD_SPEED_METERS_PER_SECOND * dt;
    return Math.min(Math.max(next, 0), rod.length);
  });
}

/** The rod's velocity as it moves, nothing while it stands — at either end, or a screw across gravity. */
export function rodVelocity(rod: Rod, extension: number, down: Vector2): Vector2 {
  const way = drive(rod, down);
  if ((way > 0 && extension >= rod.length) || (way < 0 && extension <= 0)) {
    return ZERO;
  }
  return scale(rod.direction, way * ROD_SPEED_METERS_PER_SECOND);
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
  const tipLength = rodTipLength(rod.kind);
  const side = scale(rightNormal(rod.direction), rodWidth(rod.kind) / 2);
  const out = Math.max(extension, tipLength + SHAPE_MIN_BODY_METERS);
  const tip = add(rod.base, scale(rod.direction, out));
  const shoulder = subtract(tip, scale(rod.direction, tipLength));
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
  const reach = distance(from, to) + radius;
  for (let index = 0; index < rods.length; index += 1) {
    // The course holds hundreds of rods: only one within its own length of the motion can be met.
    if (extensions[index] <= 0 || distance(rods[index].base, from) > rods[index].length + reach) {
      continue;
    }
    const hit = sweepCircleAgainstWall(rodShape(rods[index], extensions[index]), from, to, radius);
    if (hit !== undefined && (best === undefined || hit.time < best.time)) {
      best = { ...hit, rod: index };
    }
  }
  return best;
}
