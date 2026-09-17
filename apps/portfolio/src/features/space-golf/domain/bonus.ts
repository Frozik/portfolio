import type { Vector2 } from '@frozik/utils/math/vector2';

import { distanceToSegment } from './collision';
import {
  BALL_RADIUS_METERS,
  BONUS_MAX_STROKES,
  BONUS_MIN_STROKES,
  BONUS_RADIUS_METERS,
  FLOATER_LARGE_SIDE_METERS,
} from './constants';
import { createRandom } from './generator/random';
import type { Level, Segment, Wall } from './level';
import { rodSeat, rodWidth } from './rods';
import { distance, normalize, rightNormal, subtract } from './vector';
import { containsPoint } from './walls';

/**
 * The one bonus on the board: a disc the ball flies through and takes. It
 * stays for one to three strokes and then moves — only once the ball has
 * come to rest, so the player can plan a stroke for it. `moves` numbers the
 * spots it has had: with the level's seed it fixes the next one, so a level
 * plays the same every time.
 */
export interface BonusState {
  /** Where the disc is; nothing while it is taken and the ball has not rested yet. */
  readonly at: Vector2 | undefined;
  /** Strokes it still stays for; at nought it moves at the ball's next rest. */
  readonly strokesLeft: number;
  readonly moves: number;
}

/** Spots tried before the bonus sits this turn out. */
const ATTEMPTS = 200;
/** Open space kept between the disc and anything solid. */
const CLEARANCE_METERS = 0.3;
/** The disc never appears on top of the ball: it has to be played for. */
const MIN_BALL_DISTANCE_METERS = 2;
/** The large diamond reaches this far from a floater's centre. */
const FLOATER_REACH_METERS = (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;
const SEED_STRIDE = 1009;

/** The bonus in its spot number `moves`, away from the ball where it rests. */
export function placeBonus(level: Level, moves: number, ball: Vector2): BonusState {
  const random = createRandom(level.seed * SEED_STRIDE + moves);
  const inset = BONUS_RADIUS_METERS + CLEARANCE_METERS;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const at: Vector2 = {
      x: inset + random.next() * (level.width - 2 * inset),
      y: inset + random.next() * (level.height - 2 * inset),
    };
    if (distance(at, ball) >= MIN_BALL_DISTANCE_METERS && isInTheOpen(level, at)) {
      return { at, strokesLeft: random.int(BONUS_MIN_STROKES, BONUS_MAX_STROKES), moves };
    }
  }
  return { at: undefined, strokesLeft: BONUS_MIN_STROKES, moves };
}

/** A stroke has been played: one fewer to stay for. */
export function afterStroke(bonus: BonusState): BonusState {
  return { ...bonus, strokesLeft: Math.max(0, bonus.strokesLeft - 1) };
}

/** Whether it is time to move: checked only while the ball rests. */
export function isDue(bonus: BonusState): boolean {
  return bonus.strokesLeft <= 0;
}

/** Whether a ball that went straight from `from` to `to` touched the disc. */
export function isTaken(bonus: BonusState, from: Vector2, to: Vector2): boolean {
  if (bonus.at === undefined) {
    return false;
  }
  const reach = BONUS_RADIUS_METERS + BALL_RADIUS_METERS;
  return distance(from, to) === 0
    ? distance(bonus.at, to) <= reach
    : distanceToSegment(bonus.at, segmentOf(from, to)) <= reach;
}

/** The bonus once taken: gone, and due for a new spot at the ball's next rest. */
export function taken(bonus: BonusState): BonusState {
  return { ...bonus, at: undefined, strokesLeft: 0 };
}

function isInTheOpen(level: Level, at: Vector2): boolean {
  const reach = BONUS_RADIUS_METERS + CLEARANCE_METERS;
  return (
    level.walls.every(wall => isClearOf(wall, at, reach)) &&
    level.floaters.every(floater => distance(floater.center, at) >= reach + FLOATER_REACH_METERS) &&
    level.spikes.every(row => row.sides.every(side => distanceToSegment(at, side) >= reach)) &&
    level.rods.every(
      rod =>
        distanceToSegment(at, segmentOf(rod.base, rodSeat(rod))) >= reach + rodWidth(rod.kind) / 2
    )
  );
}

function isClearOf(wall: Wall, at: Vector2, reach: number): boolean {
  const { min, max } = wall.bounds;
  if (
    at.x < min.x - reach ||
    at.x > max.x + reach ||
    at.y < min.y - reach ||
    at.y > max.y + reach
  ) {
    return true;
  }
  return !containsPoint(wall, at) && wall.edges.every(edge => distanceToSegment(at, edge) >= reach);
}

function segmentOf(from: Vector2, to: Vector2): Segment {
  const direction = normalize(subtract(to, from));
  return { from, to, direction, normal: rightNormal(direction), length: distance(from, to) };
}
