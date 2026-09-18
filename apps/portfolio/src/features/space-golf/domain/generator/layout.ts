import type { Vector2 } from '@frozik/utils/math/vector2';

import { BALL_RADIUS_METERS, CELL_METERS, CONTACT_EPSILON_METERS } from '../constants';
import type { Wall } from '../level';
import type { Cell, CellGrid, CellRect } from './cell-grid';
import { fillRect, gridOfCells, isBlock, sealUnreachable } from './cell-grid';
import type { Island, IslandKind } from './island';
import { growIsland, seedIsland } from './island';
import { createIslandWall } from './island-wall';
import { traceOutlines } from './outline';
import type { Random } from './random';

/**
 * The original's mix — read off its 19 × 26 cell arena as ten to fifteen
 * grown islands and five to nine islets — as counts per cell of ground, so a
 * sector of any size is as dense.
 */
const REFERENCE_CELLS = 1296;
const BODIES: Range = { min: 10, max: 15 };
const ISLETS: Range = { min: 5, max: 9 };
/** Cells of the budget the growing islands leave for the islets, per reference area. */
const ISLET_RESERVE_CELLS = 30;
/** The seeds take at most this share of the budget: the rest is for the arms that make the shapes. */
const SEED_BUDGET_SHARE = 0.45;
const SEED_ATTEMPTS = 200;
/** Arms every island may gain, one per round so they all get their turn while there is room. */
const ARM_ROUNDS = 6;
const ARM_ATTEMPTS_PER_ROUND = 12;
/** Share of the ground the islands may fill. */
const MAX_SOLID_SHARE = 0.3;
/** The tee shelf: a block a metre square the very first ball starts on, in cells. */
const TEE_SHELF_WIDTH = 2;
const TEE_SHELF_HEIGHT = 2;
/** Nowhere near anything: the tee of a layout that has none, for the corner cuts that spare the tee's floor. */
const NO_TEE: Vector2 = { x: -1e6, y: -1e6 };

interface Range {
  readonly min: number;
  readonly max: number;
}

/**
 * What to lay out: a window of cells, the `region` of it that is this
 * layout's own ground — islands are seeded inside it and may reach `overhang`
 * cells past it — and what already stands in the window: cells no island
 * may touch or come within the gap of.
 */
export interface LayoutPlan {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly region: CellRect;
  readonly overhangCells: number;
  readonly obstacles: readonly Cell[];
  readonly withTee: boolean;
}

export interface Layout {
  /** This layout's own islands only, for tracing and for probing depth. */
  readonly grid: CellGrid;
  /** The cells of those islands. */
  readonly cells: readonly Cell[];
  readonly walls: readonly Wall[];
  readonly tee: Vector2 | undefined;
}

/**
 * Islands scattered over the region, seeded first and grown afterwards in
 * rounds so each takes a shape of its own, keeping every empty cell of the
 * window reachable on foot and the gap to whatever already stands there.
 */
export function createLayout(random: Random, plan: LayoutPlan): Layout {
  let grid = gridOfCells(plan.widthCells, plan.heightCells, plan.obstacles);
  const { region } = plan;
  const shelf: CellRect | undefined = plan.withTee
    ? {
        x: region.x + Math.floor((region.width - TEE_SHELF_WIDTH) / 2),
        y: region.y + Math.floor(region.height / 2),
        width: TEE_SHELF_WIDTH,
        height: TEE_SHELF_HEIGHT,
      }
    : undefined;
  if (shelf !== undefined) {
    grid = fillRect(grid, shelf);
  }
  const anchor: Cell =
    shelf === undefined
      ? emptyCellNear(grid, region)
      : { x: shelf.x, y: shelf.y + TEE_SHELF_HEIGHT };
  grid = sealUnreachable(grid, anchor);

  const areaShare = (region.width * region.height) / REFERENCE_CELLS;
  const budget = Math.floor(region.width * region.height * MAX_SOLID_SHARE);
  let solidCount = shelf === undefined ? 0 : shelf.width * shelf.height;
  const islands: Island[] = [];
  const seed = (kind: IslandKind, range: Range, limit: number): void => {
    const wanted = Math.max(1, Math.round(random.int(range.min, range.max) * areaShare));
    let placed = 0;
    for (let attempt = 0; attempt < SEED_ATTEMPTS && placed < wanted; attempt += 1) {
      const seeded = seedIsland(random, grid, anchor, kind, region);
      if (seeded !== undefined && solidCount + seeded.island.cells.size <= limit) {
        grid = seeded.grid;
        islands.push(seeded.island);
        solidCount += seeded.island.cells.size;
        placed += 1;
      }
    }
  };
  const growthBudget = budget - Math.round(ISLET_RESERVE_CELLS * areaShare);
  const growthLimit: CellRect = {
    x: region.x - plan.overhangCells,
    y: region.y - plan.overhangCells,
    width: region.width + 2 * plan.overhangCells,
    height: region.height + 2 * plan.overhangCells,
  };
  seed('body', BODIES, Math.floor(growthBudget * SEED_BUDGET_SHARE));
  for (let round = 0; round < ARM_ROUNDS; round += 1) {
    islands.forEach((island, index) => {
      for (let attempt = 0; attempt < ARM_ATTEMPTS_PER_ROUND; attempt += 1) {
        const grown = growIsland(
          random,
          grid,
          island,
          anchor,
          growthBudget - solidCount,
          growthLimit
        );
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
  const tee: Vector2 | undefined =
    shelf === undefined
      ? undefined
      : {
          x: (shelf.x + shelf.width / 2) * CELL_METERS,
          y: (shelf.y + shelf.height) * CELL_METERS + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS,
        };
  const own = ownGrid(plan, islands, shelf);
  const walls = traceOutlines(own).map(outline =>
    createIslandWall(outline, own, random, tee ?? NO_TEE)
  );
  return { grid: own, cells: cellsOf(own), walls, tee };
}

/** An empty cell of the region, the nearest to its middle: where walking the window starts. */
function emptyCellNear(grid: CellGrid, region: CellRect): Cell {
  const middle = { x: region.x + region.width / 2, y: region.y + region.height / 2 };
  let nearest: Cell | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const distance = Math.hypot(x - middle.x, y - middle.y);
      if (!isBlock(grid, x, y) && distance < nearestDistance) {
        nearest = { x, y };
        nearestDistance = distance;
      }
    }
  }
  if (nearest === undefined) {
    throw new Error('createLayout: the region has no empty cell');
  }
  return nearest;
}

/** The window with this layout's islands alone: what stood there before is somebody else's to draw. */
function ownGrid(
  plan: LayoutPlan,
  islands: readonly Island[],
  shelf: CellRect | undefined
): CellGrid {
  const cells = islands.flatMap(island =>
    [...island.cells].map(key => {
      const x = key % plan.widthCells;
      return { x, y: (key - x) / plan.widthCells };
    })
  );
  const grid = gridOfCells(plan.widthCells, plan.heightCells, cells);
  return shelf === undefined ? grid : fillRect(grid, shelf);
}

function cellsOf(grid: CellGrid): readonly Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (isBlock(grid, x, y)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}
