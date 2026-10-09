import type { Vector2 } from '@frozik/utils/math/vector2';

import { BALL_RADIUS_METERS, CELL_METERS, CONTACT_EPSILON_METERS } from '../constants';
import type { Wall } from '../level';
import type { Cell, CellGrid, CellRect } from './cell-grid';
import { fillRect, gridOfCells, isBlock, sealUnreachable } from './cell-grid';
import type { Island, IslandKind, Placement } from './island';
import { growIsland, seedIsland } from './island';
import { createIslandWall } from './island-wall';
import { traceOutlines } from './outline';
import type { Random } from './random';
import { widestVoid } from './voids';

/**
 * Counts per cell of ground, so a sector of any size is as dense. The
 * original's 19 × 26 arena reads as ten to fifteen grown islands and five
 * to nine islets; with every body grown on the spot and kept only once it
 * has its arms, fewer and bigger ones fill the same ground (2026-10-10:
 * half the islands came out plain rectangles, a third six cells or less).
 */
const REFERENCE_CELLS = 1296;
const BODIES: Range = { min: 8, max: 11 };
const ISLETS: Range = { min: 0, max: 2 };
/** Cells of the budget the growing islands leave for the islets, per reference area. */
const ISLET_RESERVE_CELLS = 20;
const SEED_ATTEMPTS = 200;
/** A body is kept only with this many arms grown: a bare block or bar is no shape. */
const ARMS: Range = { min: 2, max: 6 };
const ARM_ATTEMPTS = 60;
/**
 * No spot of the ground lies farther than this from an island, in cells — a
 * random scatter left whole screens empty (2026-10-10), with nowhere to land
 * within a shot. The widest gaps get an island of their own, if one fits.
 */
const MAX_VOID_CELLS = 6;
const VOID_FILLS = 8;
/** A void's island is not held to the share: the bodies may have spent it all elsewhere. */
const VOID_ISLAND_CELLS = 30;
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
 * may touch or come within the gap of, the islands next door among them.
 */
export interface LayoutPlan {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly region: CellRect;
  readonly overhangCells: number;
  /** The islands next door: the ball can land on them, so ground near them is no void. */
  readonly land: readonly Cell[];
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
 * Islands scattered over the region, each body grown into its shape as soon
 * as it is seeded and dropped if it cannot take one, keeping every empty cell of the
 * window reachable on foot and the gap to whatever already stands there.
 */
export function createLayout(random: Random, plan: LayoutPlan): Layout {
  let grid = gridOfCells(plan.widthCells, plan.heightCells, [...plan.land, ...plan.obstacles]);
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
  const wanted = (range: Range): number => Math.round(random.int(range.min, range.max) * areaShare);
  const growthBudget = budget - Math.round(ISLET_RESERVE_CELLS * areaShare);
  const growthLimit: CellRect = {
    x: region.x - plan.overhangCells,
    y: region.y - plan.overhangCells,
    width: region.width + 2 * plan.overhangCells,
    height: region.height + 2 * plan.overhangCells,
  };
  const place = (kind: IslandKind, count: number, limit: number, within: CellRect): number => {
    let placed = 0;
    for (let attempt = 0; attempt < SEED_ATTEMPTS && placed < count; attempt += 1) {
      const seeded = seedIsland(random, grid, anchor, kind, within);
      const shaped =
        seeded === undefined || kind === 'islet'
          ? seeded
          : shapeBody(random, seeded, anchor, limit - solidCount, growthLimit);
      if (shaped !== undefined && solidCount + shaped.island.cells.size <= limit) {
        grid = shaped.grid;
        islands.push(shaped.island);
        solidCount += shaped.island.cells.size;
        placed += 1;
      }
    }
    return placed;
  };
  place('body', Math.max(1, wanted(BODIES)), growthBudget, region);
  place('islet', wanted(ISLETS), budget, region);

  const spared: Cell[] = [];
  for (let fill = 0; fill < VOID_FILLS; fill += 1) {
    const land = landGrid(plan, islands, shelf);
    const gap = widestVoid(land, region, spared, MAX_VOID_CELLS);
    if (gap === undefined || gap.reach <= MAX_VOID_CELLS) {
      break;
    }
    const around = clip(region, {
      x: gap.cell.x - MAX_VOID_CELLS,
      y: gap.cell.y - MAX_VOID_CELLS,
      width: 2 * MAX_VOID_CELLS + 1,
      height: 2 * MAX_VOID_CELLS + 1,
    });
    const limit = solidCount + VOID_ISLAND_CELLS;
    const filled = place('body', 1, limit, around) > 0 || place('islet', 1, limit, around) > 0;
    if (!filled) {
      spared.push(gap.cell);
    }
  }

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

/**
 * The freshly seeded body grown arm by arm, each arm fitting the rest of the
 * budget; nothing when it could not reach the fewest arms a shape needs or
 * its arms only filled it out into a bigger block.
 */
function shapeBody(
  random: Random,
  seeded: Placement,
  anchor: Cell,
  budget: number,
  limit: CellRect
): Placement | undefined {
  const arms = random.int(ARMS.min, ARMS.max);
  let shaped = seeded;
  let grown = 0;
  for (let attempt = 0; attempt < ARM_ATTEMPTS && grown < arms; attempt += 1) {
    const spent = shaped.island.cells.size;
    const next = growIsland(random, shaped.grid, shaped.island, anchor, budget - spent, limit);
    if (next !== undefined) {
      shaped = next;
      grown += 1;
    }
  }
  const { cells, bounds } = shaped.island;
  const bare = cells.size === bounds.width * bounds.height;
  return grown >= ARMS.min && !bare ? shaped : undefined;
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

/** What the ball can land on: this layout's islands and the shelf, and the islands next door. */
function landGrid(
  plan: LayoutPlan,
  islands: readonly Island[],
  shelf: CellRect | undefined
): CellGrid {
  const own = cellsOf(ownGrid(plan, islands, shelf));
  return gridOfCells(plan.widthCells, plan.heightCells, [...plan.land, ...own]);
}

function clip(outer: CellRect, inner: CellRect): CellRect {
  const x = Math.max(outer.x, inner.x);
  const y = Math.max(outer.y, inner.y);
  return {
    x,
    y,
    width: Math.min(outer.x + outer.width, inner.x + inner.width) - x,
    height: Math.min(outer.y + outer.height, inner.y + inner.height) - y,
  };
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
