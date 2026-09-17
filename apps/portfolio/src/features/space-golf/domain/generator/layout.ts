import type { Vector2 } from '@frozik/utils/math/vector2';

import {
  BALL_RADIUS_METERS,
  BOARD_HEIGHT_METERS,
  BOARD_WIDTH_METERS,
  CELL_METERS,
  CONTACT_EPSILON_METERS,
} from '../constants';
import type { Wall } from '../level';
import type { Cell, CellGrid, CellRect } from './cell-grid';
import { createEmptyGrid, fillRect } from './cell-grid';
import type { Island, IslandKind } from './island';
import { growIsland, seedIsland } from './island';
import { createIslandWall } from './island-wall';
import { traceOutlines } from './outline';
import type { Random } from './random';

const GRID_WIDTH = BOARD_WIDTH_METERS / CELL_METERS;
const GRID_HEIGHT = BOARD_HEIGHT_METERS / CELL_METERS;
/**
 * The original's mix, scaled from its 19 × 26 cells to this board's area:
 * a few shores framing the level, bodies between them, and islets dropped
 * last into what room is left.
 */
const SHORES: Range = { min: 3, max: 5 };
const BODIES: Range = { min: 7, max: 10 };
const ISLETS: Range = { min: 5, max: 9 };
/** Cells of the budget the growing islands leave for the islets. */
const ISLET_RESERVE_CELLS = 30;
/** The seeds take at most this share of the budget: the rest is for the arms that make the shapes. */
const SEED_BUDGET_SHARE = 0.45;
const SEED_ATTEMPTS = 200;
/** Arms every island may gain, one per round so they all get their turn while there is room. */
const ARM_ROUNDS = 6;
const ARM_ATTEMPTS_PER_ROUND = 12;
/** Share of the board the islands may fill. */
const MAX_SOLID_SHARE = 0.3;
/** The tee shelf: a block a metre square in the upper third the ball starts on, in cells; its row a share of the board's height. */
const TEE_SHELF_WIDTH = 2;
const TEE_SHELF_HEIGHT = 2;
const TEE_SHELF_MIN_SHARE = 0.69;
const TEE_SHELF_MAX_SHARE = 0.81;
const TEE_SHELF_MIN_ROW = Math.round(GRID_HEIGHT * TEE_SHELF_MIN_SHARE);
const TEE_SHELF_MAX_ROW = Math.round(GRID_HEIGHT * TEE_SHELF_MAX_SHARE);

interface Range {
  readonly min: number;
  readonly max: number;
}

export interface Layout {
  readonly grid: CellGrid;
  readonly walls: readonly Wall[];
  readonly tee: Vector2;
  readonly teeCell: Cell;
}

/**
 * A handful of islands scattered over the board around a tee shelf, seeded
 * first and grown afterwards in rounds so each takes a shape of its own,
 * keeping every empty cell reachable from the tee on foot. Nothing closes
 * the board: the space around it is open, and a ball can leave through any
 * gap.
 */
export function createLayout(random: Random): Layout {
  let grid = createEmptyGrid(GRID_WIDTH, GRID_HEIGHT);
  const shelf: CellRect = {
    x: random.int(0, GRID_WIDTH - TEE_SHELF_WIDTH),
    y: random.int(TEE_SHELF_MIN_ROW, TEE_SHELF_MAX_ROW),
    width: TEE_SHELF_WIDTH,
    height: TEE_SHELF_HEIGHT,
  };
  grid = fillRect(grid, shelf);
  const teeCell: Cell = {
    x: shelf.x + random.int(0, TEE_SHELF_WIDTH - 1),
    y: shelf.y + TEE_SHELF_HEIGHT,
  };

  const budget = Math.floor(GRID_WIDTH * GRID_HEIGHT * MAX_SOLID_SHARE);
  let solidCount = shelf.width * shelf.height;
  const islands: Island[] = [];
  const seed = (kind: IslandKind, range: Range, limit: number): void => {
    const wanted = random.int(range.min, range.max);
    let placed = 0;
    for (let attempt = 0; attempt < SEED_ATTEMPTS && placed < wanted; attempt += 1) {
      const seeded = seedIsland(random, grid, teeCell, kind);
      if (seeded !== undefined && solidCount + seeded.island.cells.size <= limit) {
        grid = seeded.grid;
        islands.push(seeded.island);
        solidCount += seeded.island.cells.size;
        placed += 1;
      }
    }
  };
  const growthBudget = budget - ISLET_RESERVE_CELLS;
  const seedBudget = Math.floor(growthBudget * SEED_BUDGET_SHARE);
  // Bodies first: they take the middle of the board, and the shores then lie where the edges are still free.
  seed('body', BODIES, seedBudget);
  seed('shore', SHORES, seedBudget);
  for (let round = 0; round < ARM_ROUNDS; round += 1) {
    islands.forEach((island, index) => {
      for (let attempt = 0; attempt < ARM_ATTEMPTS_PER_ROUND; attempt += 1) {
        const grown = growIsland(random, grid, island, teeCell, growthBudget - solidCount);
        if (grown !== undefined) {
          grid = grown.grid;
          solidCount += grown.island.cells.size - island.cells.size;
          islands[index] = grown.island;
          return;
        }
      }
    });
  }

  seed('islet', ISLETS, budget);

  // The ball starts in the middle of the shelf's top, flat floor on either side of it.
  const tee = {
    x: (shelf.x + shelf.width / 2) * CELL_METERS,
    y: teeCell.y * CELL_METERS + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS,
  };
  const walls = traceOutlines(grid).map(outline => createIslandWall(outline, grid, random, tee));
  return { grid, walls, tee, teeCell };
}
