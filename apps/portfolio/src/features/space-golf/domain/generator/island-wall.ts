import type { Vector2 } from '@frozik/utils/math/vector2';

import { CELL_METERS } from '../constants';
import type { Wall } from '../level';
import { createWall } from '../walls';
import type { Cell, CellGrid } from './cell-grid';
import { isBlock } from './cell-grid';
import type { Random } from './random';

/**
 * The board has no walls: an island touching its edge is cut by the screen,
 * not by a corner, so it runs on this far beyond the edge — out of sight,
 * but there for a ball that leaves the board along it.
 */
const EDGE_BLEED_METERS = 1;
/**
 * Every corner is cut at 45°: a ball in a right-angled corner would touch a
 * horizontal and a vertical face at once, and which of them is the floor
 * would be anyone's guess. Convex corners are chamfered, concave ones get a
 * fillet — the same cut, one taking solid away and the other adding it.
 */
const CORNER_CUT_METERS = 0.1;
/**
 * Most corners, convex and concave alike, get a long diagonal instead, as
 * the original's islands have: blocks come out octagonal and the inner
 * corners of an L or a T are filled at 45°.
 */
const LONG_CUTS_METERS: readonly number[] = [0.25, 0.5, 1];
const LONG_CUT_CHANCE = 0.6;
/** The end of a limb one cell thick is mostly cut to a point, the original's lozenge. */
const POINT_CHANCE = 0.7;
const POINT_CUT_METERS = CELL_METERS / 2;
const LENGTH_TOLERANCE_METERS = 1e-9;
/** What every face keeps flat between its two cuts. */
const MIN_FLAT_METERS = 0.3;
/** No long diagonal within this of the tee: the ball must start on flat floor and stay there. */
const TEE_FLAT_RADIUS_METERS = 0.6;

/**
 * One island as one wall: the outline's corners on the board's edge are
 * pushed out past it and stay square out there; every other corner is cut
 * at 45°, some convex ones by a long diagonal when both faces have the
 * room — never a corner near the tee, whose floor stays flat under the
 * ball (2026-09-18: a ball that started over a long diagonal slid off).
 */
export function createIslandWall(
  outline: readonly Cell[],
  grid: CellGrid,
  random: Random,
  tee: Vector2
): Wall {
  const board = { width: grid.width * CELL_METERS, height: grid.height * CELL_METERS };
  const points = outline.map(point =>
    bleed({ x: point.x * CELL_METERS, y: point.y * CELL_METERS }, board)
  );
  const count = points.length;
  const at = (index: number): Vector2 => points[(index + count) % count];
  const lengths = points.map((point, index) => distance(point, at(index + 1)));
  const cuts: number[] = points.map(point => (isBeyondBoard(point, board) ? 0 : CORNER_CUT_METERS));

  const convex = points.map((point, index) => isConvex(at(index - 1), point, at(index + 1)));
  const pointed = new Set<number>();
  const free = (index: number): boolean =>
    cuts[index] === CORNER_CUT_METERS && distance(points[index], tee) >= TEE_FLAT_RADIUS_METERS;

  // The end face of a thin limb: both of its corners cut halfway, so the face is gone and the limb ends in a point.
  points.forEach((_, index) => {
    const next = (index + 1) % count;
    const before = (index - 1 + count) % count;
    const isThinEnd =
      Math.abs(lengths[index] - CELL_METERS) < LENGTH_TOLERANCE_METERS &&
      convex[index] &&
      convex[next] &&
      free(index) &&
      free(next);
    const sidesHaveRoom =
      lengths[before] - cuts[before] - MIN_FLAT_METERS >= POINT_CUT_METERS &&
      lengths[next] - cuts[(next + 1) % count] - MIN_FLAT_METERS >= POINT_CUT_METERS;
    if (isThinEnd && sidesHaveRoom && random.chance(POINT_CHANCE)) {
      cuts[index] = POINT_CUT_METERS;
      cuts[next] = POINT_CUT_METERS;
      pointed.add(index).add(next);
    }
  });

  points.forEach((point, index) => {
    if (pointed.has(index) || !free(index) || !random.chance(LONG_CUT_CHANCE)) {
      return;
    }
    const before = (index - 1 + count) % count;
    const after = (index + 1) % count;
    const room = Math.min(
      lengths[before] - cuts[before] - MIN_FLAT_METERS,
      lengths[index] - cuts[after] - MIN_FLAT_METERS
    );
    const incoming = direction(at(index - 1), point);
    const outgoing = direction(point, at(index + 1));
    const sizes = LONG_CUTS_METERS.filter(
      size =>
        size <= room &&
        (size <= CELL_METERS || staysClear(grid, point, incoming, outgoing, convex[index]))
    );
    if (sizes.length > 0) {
      cuts[index] = random.pick(sizes);
    }
  });

  const vertices: Vector2[] = [];
  points.forEach((point, index) => {
    const cut = cuts[index];
    if (cut === 0) {
      vertices.push(point);
      return;
    }
    const incoming = direction(at(index - 1), point);
    const outgoing = direction(point, at(index + 1));
    vertices.push(
      { x: point.x - incoming.x * cut, y: point.y - incoming.y * cut },
      { x: point.x + outgoing.x * cut, y: point.y + outgoing.y * cut }
    );
  });
  return createWall(withoutRepeats(vertices));
}

/** A face cut away whole leaves its two ends on one spot: one vertex, not two. */
function withoutRepeats(vertices: readonly Vector2[]): Vector2[] {
  return vertices.filter((vertex, index) => {
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    return distance(previous, vertex) > LENGTH_TOLERANCE_METERS;
  });
}

/**
 * A cut longer than a cell reaches the corner of the cell diagonally across
 * from it; the outline must not pass there. Behind a convex corner that
 * cell has to be solid, beyond a concave one empty.
 */
function staysClear(
  grid: CellGrid,
  point: Vector2,
  incoming: Vector2,
  outgoing: Vector2,
  convex: boolean
): boolean {
  const DIAGONAL_CELLS = 1.5;
  const probe = {
    x: point.x + (outgoing.x - incoming.x) * DIAGONAL_CELLS * CELL_METERS,
    y: point.y + (outgoing.y - incoming.y) * DIAGONAL_CELLS * CELL_METERS,
  };
  const solid = isBlock(grid, Math.floor(probe.x / CELL_METERS), Math.floor(probe.y / CELL_METERS));
  return solid === convex;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

function bleed(point: Vector2, board: Size): Vector2 {
  return {
    x:
      point.x === 0
        ? -EDGE_BLEED_METERS
        : point.x === board.width
          ? board.width + EDGE_BLEED_METERS
          : point.x,
    y:
      point.y === 0
        ? -EDGE_BLEED_METERS
        : point.y === board.height
          ? board.height + EDGE_BLEED_METERS
          : point.y,
  };
}

function isBeyondBoard(point: Vector2, board: Size): boolean {
  return point.x < 0 || point.y < 0 || point.x > board.width || point.y > board.height;
}

/** A left turn on a counter-clockwise outline is a convex corner of the solid. */
function isConvex(before: Vector2, point: Vector2, after: Vector2): boolean {
  const ax = point.x - before.x;
  const ay = point.y - before.y;
  const bx = after.x - point.x;
  const by = after.y - point.y;
  return ax * by - ay * bx > 0;
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Unit vector from `a` to `b`; the outline's edges are axis-aligned, so this is exact. */
function direction(a: Vector2, b: Vector2): Vector2 {
  const size = distance(a, b);
  return { x: (b.x - a.x) / size, y: (b.y - a.y) / size };
}
