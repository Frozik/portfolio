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
import type { Island } from './island';
import { growIsland, seedIsland } from './island';
import { createIslandWall } from './island-wall';
import { traceOutlines } from './outline';
import type { Random } from './random';

const GRID_WIDTH = BOARD_WIDTH_METERS / CELL_METERS;
const GRID_HEIGHT = BOARD_HEIGHT_METERS / CELL_METERS;
const MIN_ISLANDS = 10;
const MAX_ISLANDS = 14;
const SEED_ATTEMPTS = 200;
/** Arms every island may gain, one per round so they all get their turn while there is room. */
const ARM_ROUNDS = 3;
const ARM_ATTEMPTS_PER_ROUND = 6;
/** Share of the board the islands may fill. */
const MAX_SOLID_SHARE = 0.3;
/** The tee shelf: a small block in the upper third the ball starts on, in cells. */
const TEE_SHELF_WIDTH = 2;
const TEE_SHELF_MIN_ROW = 22;
const TEE_SHELF_MAX_ROW = 26;

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
    height: 1,
  };
  grid = fillRect(grid, shelf);
  const teeCell: Cell = { x: shelf.x + random.int(0, TEE_SHELF_WIDTH - 1), y: shelf.y + 1 };

  const budget = Math.floor(GRID_WIDTH * GRID_HEIGHT * MAX_SOLID_SHARE);
  let solidCount = shelf.width;
  const islands: Island[] = [];
  const wanted = random.int(MIN_ISLANDS, MAX_ISLANDS);
  for (let attempt = 0; attempt < SEED_ATTEMPTS && islands.length < wanted; attempt += 1) {
    const seeded = seedIsland(random, grid, teeCell);
    if (seeded !== undefined && solidCount + seeded.island.cells.size <= budget) {
      grid = seeded.grid;
      islands.push(seeded.island);
      solidCount += seeded.island.cells.size;
    }
  }
  for (let round = 0; round < ARM_ROUNDS; round += 1) {
    islands.forEach((island, index) => {
      for (let attempt = 0; attempt < ARM_ATTEMPTS_PER_ROUND; attempt += 1) {
        const grown = growIsland(random, grid, island, teeCell, budget - solidCount);
        if (grown !== undefined) {
          grid = grown.grid;
          solidCount += grown.island.cells.size - island.cells.size;
          islands[index] = grown.island;
          return;
        }
      }
    });
  }

  const walls = traceOutlines(grid).map(outline => createIslandWall(outline, grid, random));
  const tee = {
    x: (teeCell.x + 1 / 2) * CELL_METERS,
    y: teeCell.y * CELL_METERS + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS,
  };
  return { grid, walls, tee, teeCell };
}
