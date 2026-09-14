import type { Vector2 } from '@frozik/utils/math/vector2';

import { CELL_METERS } from '../constants';
import type { Wall } from '../level';
import { createWall } from '../walls';
import type { Cell, CellGrid } from './cell-grid';
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
/** Some convex corners get a long diagonal face instead, as the original's blocks have. */
const LONG_CHAMFERS_METERS: readonly number[] = [0.5, 1];
const LONG_CHAMFER_CHANCE = 0.3;
/** What every face keeps flat between its two cuts. */
const MIN_FLAT_METERS = 0.3;

/**
 * One island as one wall: the outline's corners on the board's edge are
 * pushed out past it and stay square out there; every other corner is cut
 * at 45°, some convex ones by a long diagonal when both faces have the room.
 */
export function createIslandWall(outline: readonly Cell[], grid: CellGrid, random: Random): Wall {
  const board = { width: grid.width * CELL_METERS, height: grid.height * CELL_METERS };
  const points = outline.map(point =>
    bleed({ x: point.x * CELL_METERS, y: point.y * CELL_METERS }, board)
  );
  const count = points.length;
  const at = (index: number): Vector2 => points[(index + count) % count];
  const lengths = points.map((point, index) => distance(point, at(index + 1)));
  const cuts: number[] = points.map(point => (isBeyondBoard(point, board) ? 0 : CORNER_CUT_METERS));

  points.forEach((point, index) => {
    if (cuts[index] === 0 || !isConvex(at(index - 1), point, at(index + 1))) {
      return;
    }
    if (!random.chance(LONG_CHAMFER_CHANCE)) {
      return;
    }
    const before = (index - 1 + count) % count;
    const after = (index + 1) % count;
    const room = Math.min(
      lengths[before] - cuts[before] - MIN_FLAT_METERS,
      lengths[index] - cuts[after] - MIN_FLAT_METERS
    );
    const sizes = LONG_CHAMFERS_METERS.filter(size => size <= room);
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
  return createWall(vertices);
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
