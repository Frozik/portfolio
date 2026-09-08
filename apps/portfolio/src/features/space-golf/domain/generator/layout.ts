import type { Vector2 } from '@frozik/utils/math/vector2';

import {
  BALL_RADIUS_METERS,
  BOARD_HEIGHT_METERS,
  BOARD_WIDTH_METERS,
  CONTACT_EPSILON_METERS,
} from '../constants';
import type { Wall } from '../level';
import { createChamferedBlock, createTriangle, type Corner } from '../walls';
import type { Cell, CellGrid, CellRect } from './cell-grid';
import {
  createEmptyGrid,
  fillRect,
  hasDiagonalOnlyContact,
  isBlock,
  isConnected,
  isSolid,
  overlapsSolid,
  randomRect,
  solidRectangles,
} from './cell-grid';
import type { Random } from './random';

/**
 * The board has no walls: a block touching its edge is cut by the screen,
 * not by a corner, so it runs on this far beyond the edge — out of sight,
 * but there for a ball that leaves the board along it.
 */
export const EDGE_BLEED_METERS = 1;
const BLOCK_ATTEMPTS = 40;
const MAX_BLOCK_WIDTH = 4;
const MAX_BLOCK_HEIGHT = 3;
/** Share of the board the blocks may fill. */
const MAX_SOLID_SHARE = 0.4;
/**
 * Every corner is cut at 45°: a ball in a right-angled corner would touch a
 * horizontal and a vertical face at once, and which of them is the floor
 * would be anyone's guess. Convex corners are chamfered, concave ones get a
 * triangular fillet.
 */
const CHAMFER_METERS = 0.35;
/** The tee shelf: a small block in the upper third the ball starts on. */
const TEE_SHELF_WIDTH = 2;
const TEE_SHELF_MIN_ROW = 11;
const TEE_SHELF_MAX_ROW = 13;

export interface Layout {
  readonly grid: CellGrid;
  readonly walls: readonly Wall[];
  readonly tee: Vector2;
  readonly teeCell: Cell;
}

/**
 * Blocks scattered over the board around a tee shelf, keeping every empty
 * cell reachable from the tee on foot — the corridor the solver later
 * confirms with real strokes. Nothing closes the board: the space around
 * it is open, and a ball can leave through any gap.
 */
export function createLayout(random: Random): Layout {
  let grid = createEmptyGrid(BOARD_WIDTH_METERS, BOARD_HEIGHT_METERS);
  const shelf: CellRect = {
    x: random.int(0, BOARD_WIDTH_METERS - TEE_SHELF_WIDTH),
    y: random.int(TEE_SHELF_MIN_ROW, TEE_SHELF_MAX_ROW),
    width: TEE_SHELF_WIDTH,
    height: 1,
  };
  grid = fillRect(grid, shelf);
  const teeCell: Cell = { x: shelf.x + random.int(0, TEE_SHELF_WIDTH - 1), y: shelf.y + 1 };

  const budget = Math.floor(BOARD_WIDTH_METERS * BOARD_HEIGHT_METERS * MAX_SOLID_SHARE);
  let solidCount = shelf.width;
  for (let attempt = 0; attempt < BLOCK_ATTEMPTS && solidCount < budget; attempt += 1) {
    const rect = randomRect(random, grid, MAX_BLOCK_WIDTH, MAX_BLOCK_HEIGHT);
    if (overlapsSolid(grid, rect) || coversCell(rect, teeCell) || touchesRect(rect, shelf)) {
      continue;
    }
    const candidate = fillRect(grid, rect);
    if (!isConnected(candidate, teeCell) || hasDiagonalOnlyContact(candidate)) {
      continue;
    }
    grid = candidate;
    solidCount += rect.width * rect.height;
  }

  const walls = [
    ...solidRectangles(grid).map(rect => blockWall(grid, rect)),
    ...concaveFillets(grid),
  ];
  const tee = { x: teeCell.x + 1 / 2, y: teeCell.y + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS };
  return { grid, walls, tee, teeCell };
}

/**
 * A block with every free-standing corner chamfered; a corner continued by
 * another solid cell — or lying beyond the board's edge — is not a corner.
 * A block at the edge bleeds past it.
 */
function blockWall(grid: CellGrid, rect: CellRect): Wall {
  const corners = new Set<Corner>();
  const candidates: readonly [Corner, Cell, Cell][] = [
    ['lowerLeft', { x: rect.x - 1, y: rect.y }, { x: rect.x, y: rect.y - 1 }],
    [
      'lowerRight',
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width - 1, y: rect.y - 1 },
    ],
    [
      'upperRight',
      { x: rect.x + rect.width, y: rect.y + rect.height - 1 },
      { x: rect.x + rect.width - 1, y: rect.y + rect.height },
    ],
    [
      'upperLeft',
      { x: rect.x - 1, y: rect.y + rect.height - 1 },
      { x: rect.x, y: rect.y + rect.height },
    ],
  ];
  for (const [corner, beside, above] of candidates) {
    if (!isSolid(grid, beside.x, beside.y) && !isSolid(grid, above.x, above.y)) {
      corners.add(corner);
    }
  }
  const left = rect.x === 0 ? -EDGE_BLEED_METERS : rect.x;
  const bottom = rect.y === 0 ? -EDGE_BLEED_METERS : rect.y;
  const right =
    rect.x + rect.width === grid.width ? grid.width + EDGE_BLEED_METERS : rect.x + rect.width;
  const top =
    rect.y + rect.height === grid.height ? grid.height + EDGE_BLEED_METERS : rect.y + rect.height;
  return createChamferedBlock(left, bottom, right - left, top - bottom, CHAMFER_METERS, corners);
}

/**
 * A 45° fillet in every concave corner: where an empty cell has blocks on
 * two adjacent sides, a triangle closes the right angle between them. The
 * board's edge is no wall, so it makes no corner.
 */
function concaveFillets(grid: CellGrid): readonly Wall[] {
  const fillets: Wall[] = [];
  const c = CHAMFER_METERS;
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (isSolid(grid, x, y)) {
        continue;
      }
      const left = isBlock(grid, x - 1, y);
      const right = isBlock(grid, x + 1, y);
      const below = isBlock(grid, x, y - 1);
      const above = isBlock(grid, x, y + 1);
      if (left && below) {
        fillets.push(createTriangle({ x, y }, { x: x + c, y }, { x, y: y + c }));
      }
      if (right && below) {
        fillets.push(createTriangle({ x: x + 1, y }, { x: x + 1, y: y + c }, { x: x + 1 - c, y }));
      }
      if (right && above) {
        fillets.push(
          createTriangle(
            { x: x + 1, y: y + 1 },
            { x: x + 1 - c, y: y + 1 },
            { x: x + 1, y: y + 1 - c }
          )
        );
      }
      if (left && above) {
        fillets.push(createTriangle({ x, y: y + 1 }, { x, y: y + 1 - c }, { x: x + c, y: y + 1 }));
      }
    }
  }
  return fillets;
}

function coversCell(rect: CellRect, cell: Cell): boolean {
  return (
    cell.x >= rect.x &&
    cell.x < rect.x + rect.width &&
    cell.y >= rect.y &&
    cell.y < rect.y + rect.height
  );
}

/** Whether two rectangles overlap or share an edge or corner. */
function touchesRect(a: CellRect, b: CellRect): boolean {
  return (
    a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
  );
}
