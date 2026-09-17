import type { Vector2 } from '@frozik/utils/math/vector2';

import { distanceToSegment } from '../collision';
import { CELL_METERS, FLOATER_CLEARANCE_METERS, FLOATER_LARGE_SIDE_METERS } from '../constants';
import { createFloater } from '../floaters';
import type { Floater, FloaterShape, Wall } from '../level';
import { distance } from '../vector';
import { containsPoint } from '../walls';
import type { Random } from './random';

const MIN_FLOATERS = 3;
const MAX_FLOATERS = 10;
const SHAPES: readonly FloaterShape[] = ['square', 'diamond', 'circle'];
const LARGE_AT_START_CHANCE = 0.5;
/** The large diamond reaches this far from the centre, farther than the other shapes: the centre keeps at least that from the board's edge. */
const LARGE_REACH_METERS = (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;
/** Candidate centres are sampled on this grid and then nudged off it, so the squares do not line up. */
const CANDIDATE_STEP_METERS = CELL_METERS / 2;

interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Floaters for a level: three to ten squares, diamonds and circles in the open —
 * as many as fit with their centres at least the clearance from every wall
 * face, from every other floater's centre and from the ball on the tee,
 * with their large shape wholly on the board. The admissible centres are
 * found on a grid first, so a board with room always gets its share; half
 * of the squares are large on the tee.
 */
export function placeFloaters(
  random: Random,
  walls: readonly Wall[],
  board: Size,
  tee: Vector2
): readonly Floater[] {
  const floaters: Floater[] = [];
  const admissible = (center: Vector2): boolean =>
    isOnBoard(center, board) &&
    distance(center, tee) >= FLOATER_CLEARANCE_METERS &&
    floaters.every(other => distance(center, other.center) >= FLOATER_CLEARANCE_METERS) &&
    walls.every(wall => isClearOf(center, wall));
  let candidates = gridCenters(board).filter(admissible);
  const wanted = random.int(MIN_FLOATERS, MAX_FLOATERS);
  while (floaters.length < wanted && candidates.length > 0) {
    const picked = random.pick(candidates);
    const nudged: Vector2 = {
      x: picked.x + (random.next() - 0.5) * CANDIDATE_STEP_METERS,
      y: picked.y + (random.next() - 0.5) * CANDIDATE_STEP_METERS,
    };
    const center = admissible(nudged) ? nudged : picked;
    floaters.push(createFloater(center, random.pick(SHAPES), random.chance(LARGE_AT_START_CHANCE)));
    candidates = candidates.filter(
      candidate => distance(candidate, center) >= FLOATER_CLEARANCE_METERS
    );
  }
  return floaters;
}

/** Every grid point whose large shape would lie on the board. */
function gridCenters(board: Size): readonly Vector2[] {
  const centers: Vector2[] = [];
  for (
    let y = LARGE_REACH_METERS;
    y <= board.height - LARGE_REACH_METERS;
    y += CANDIDATE_STEP_METERS
  ) {
    for (
      let x = LARGE_REACH_METERS;
      x <= board.width - LARGE_REACH_METERS;
      x += CANDIDATE_STEP_METERS
    ) {
      centers.push({ x, y });
    }
  }
  return centers;
}

function isOnBoard(center: Vector2, board: Size): boolean {
  return (
    center.x >= LARGE_REACH_METERS &&
    center.y >= LARGE_REACH_METERS &&
    center.x <= board.width - LARGE_REACH_METERS &&
    center.y <= board.height - LARGE_REACH_METERS
  );
}

function isClearOf(center: Vector2, wall: Wall): boolean {
  // Far from the wall's box is far from every face of it: most walls are dismissed here.
  const { min, max } = wall.bounds;
  if (
    center.x < min.x - FLOATER_CLEARANCE_METERS ||
    center.x > max.x + FLOATER_CLEARANCE_METERS ||
    center.y < min.y - FLOATER_CLEARANCE_METERS ||
    center.y > max.y + FLOATER_CLEARANCE_METERS
  ) {
    return true;
  }
  return (
    !containsPoint(wall, center) &&
    wall.edges.every(edge => distanceToSegment(center, edge) >= FLOATER_CLEARANCE_METERS)
  );
}
