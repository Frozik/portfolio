import type { Cell, CellGrid, CellRect } from './cell-grid';
import { fillRect, hasDiagonalOnlyContact, isConnected, isSolid, overlapsSolid } from './cell-grid';
import type { Random } from './random';

/** An island is a seed bar with thin arms: runs of cells two to six long — one to three metres. */
const MIN_BAR_LENGTH = 2;
const MAX_BAR_LENGTH = 6;
/** A seed two cells thick gives the island a body its arms grow out of. */
const THICK_BAR_CHANCE = 0.3;
const MAX_ISLAND_WIDTH = 7;
const MAX_ISLAND_HEIGHT = 6;
/** Empty cells kept between one island and the next — a metre, seven ball widths — so there is room to fly between them. */
const ISLAND_GAP_CELLS = 2;
const DIRECTIONS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export interface Island {
  /** Keys of the island's cells, `y * width + x`. */
  readonly cells: ReadonlySet<number>;
  readonly bounds: CellRect;
}

export interface Placement {
  readonly grid: CellGrid;
  readonly island: Island;
}

/** A new island: one bar, the gap away from everything else. Nothing when the bar has no room. */
export function seedIsland(random: Random, grid: CellGrid, teeCell: Cell): Placement | undefined {
  const bar = randomBar(random, {
    x: random.int(0, grid.width - 1),
    y: random.int(0, grid.height - 1),
  });
  if (!fits(grid, bar, teeCell, new Set()) || overlapsSolid(grid, bar)) {
    return undefined;
  }
  const grown = fillRect(grid, bar);
  if (!isConnected(grown, teeCell)) {
    return undefined;
  }
  return { grid: grown, island: { cells: new Set(cellsOf(grown, bar)), bounds: bar } };
}

/**
 * The island with one more arm: a thin bar starting next to one of its cells
 * and running off in any direction, which turns a bar into an L, a T, a U,
 * a Z or a stair. The island keeps
 * its gap from every other and stays within its box; every empty cell
 * stays reachable from the tee. Nothing when the arm does not fit.
 */
export function growIsland(
  random: Random,
  grid: CellGrid,
  island: Island,
  teeCell: Cell,
  budget: number
): Placement | undefined {
  const cell = cellOf(grid, random.pick([...island.cells]));
  const towards = random.pick(DIRECTIONS);
  const arm = armFrom(random, { x: cell.x + towards.x, y: cell.y + towards.y });
  const bounds = union(island.bounds, arm);
  if (
    bounds.width > MAX_ISLAND_WIDTH ||
    bounds.height > MAX_ISLAND_HEIGHT ||
    !fits(grid, arm, teeCell, island.cells)
  ) {
    return undefined;
  }
  const added = cellsOf(grid, arm).filter(key => !island.cells.has(key));
  if (added.length === 0 || added.length > budget) {
    return undefined;
  }
  const grown = fillRect(grid, arm);
  if (!isConnected(grown, teeCell) || hasDiagonalOnlyContact(grown)) {
    return undefined;
  }
  return { grid: grown, island: { cells: new Set([...island.cells, ...added]), bounds } };
}

/** A bar one cell thick starting at `cell` and running a random length in a random direction. */
function armFrom(random: Random, cell: Cell): CellRect {
  const length = random.int(MIN_BAR_LENGTH, MAX_BAR_LENGTH);
  const along = random.pick(DIRECTIONS);
  const far = { x: cell.x + along.x * (length - 1), y: cell.y + along.y * (length - 1) };
  return {
    x: Math.min(cell.x, far.x),
    y: Math.min(cell.y, far.y),
    width: Math.abs(far.x - cell.x) + 1,
    height: Math.abs(far.y - cell.y) + 1,
  };
}

/** The seed bar: random length and orientation, now and then two cells thick, with `cell` inside it. */
function randomBar(random: Random, cell: Cell): CellRect {
  const length = random.int(MIN_BAR_LENGTH, MAX_BAR_LENGTH);
  const thickness = random.chance(THICK_BAR_CHANCE) ? 2 : 1;
  const horizontal = random.chance(1 / 2);
  const width = horizontal ? length : thickness;
  const height = horizontal ? thickness : length;
  return {
    x: cell.x - random.int(0, width - 1),
    y: cell.y - random.int(0, height - 1),
    width,
    height,
  };
}

/**
 * Whether the rectangle lies on the board, leaves the tee cell free, and
 * stays the gap away from every solid cell other than the island's own.
 */
function fits(grid: CellGrid, rect: CellRect, teeCell: Cell, own: ReadonlySet<number>): boolean {
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > grid.width ||
    rect.y + rect.height > grid.height
  ) {
    return false;
  }
  if (covers(rect, teeCell)) {
    return false;
  }
  for (let y = rect.y - ISLAND_GAP_CELLS; y < rect.y + rect.height + ISLAND_GAP_CELLS; y += 1) {
    for (let x = rect.x - ISLAND_GAP_CELLS; x < rect.x + rect.width + ISLAND_GAP_CELLS; x += 1) {
      const onBoard = x >= 0 && y >= 0 && x < grid.width && y < grid.height;
      if (onBoard && isSolid(grid, x, y) && !own.has(keyOf(grid, { x, y }))) {
        return false;
      }
    }
  }
  return true;
}

function covers(rect: CellRect, cell: Cell): boolean {
  return (
    cell.x >= rect.x &&
    cell.x < rect.x + rect.width &&
    cell.y >= rect.y &&
    cell.y < rect.y + rect.height
  );
}

function union(a: CellRect, b: CellRect): CellRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function cellsOf(grid: CellGrid, rect: CellRect): readonly number[] {
  const keys: number[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      keys.push(keyOf(grid, { x, y }));
    }
  }
  return keys;
}

function keyOf(grid: CellGrid, cell: Cell): number {
  return cell.y * grid.width + cell.x;
}

function cellOf(grid: CellGrid, key: number): Cell {
  return { x: key % grid.width, y: Math.floor(key / grid.width) };
}
