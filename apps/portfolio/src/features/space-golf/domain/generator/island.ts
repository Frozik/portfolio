import type { Cell, CellGrid, CellRect } from './cell-grid';
import {
  fillCells,
  fillRect,
  hasDiagonalOnlyContact,
  hasNarrowSlot,
  isConnected,
  isSolid,
  overlapsSolid,
} from './cell-grid';
import type { Random } from './random';
import type { IslandKind } from './seed-shapes';
import { LIMB_THICKNESS, MAX_THICKNESS_CELLS, seedFootprint } from './seed-shapes';

const THIN_ARM_THICKNESS = 1;
const THIN_ARM_CHANCE = 0.2;
/** A thin arm is a long one: a short thin stub reads as a sliver. */
const MIN_THIN_ARM_LENGTH = 3;
const MIN_ARM_LENGTH = 3;
const MAX_ARM_LENGTH = 8;
const MAX_GIANT_ARM_LENGTH = 16;
/** No pocket or slot in an island is narrower than this many cells — a metre. */
const MIN_SLOT_CELLS = 2;
const BODY_BOX: Box = { width: 20, height: 18 };
const GIANT_BOX: Box = { width: 44, height: 30 };
/** How often a body's arm runs along its longer side rather than any way. */
const ALONG_THE_LENGTH_CHANCE = 0.5;
/** Empty cells kept between one island and the next — a metre and a half, ten ball widths — so there is room to fly between them (a metre until 2026-09-18). */
export const ISLAND_GAP_CELLS = 3;
const DIRECTIONS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

interface Box {
  readonly width: number;
  readonly height: number;
}

export interface Island {
  readonly kind: IslandKind;
  /** Keys of the island's cells, `y * width + x`. */
  readonly cells: ReadonlySet<number>;
  readonly bounds: CellRect;
}

export interface Placement {
  readonly grid: CellGrid;
  readonly island: Island;
}

/**
 * A new island of the given kind, wholly inside `region`, the gap away from
 * everything else, `anchor` left free. Nothing when it has no room.
 */
export function seedIsland(
  random: Random,
  grid: CellGrid,
  anchor: Cell,
  kind: IslandKind,
  region: CellRect
): Placement | undefined {
  const footprint = seedFootprint(random, kind);
  const rect: CellRect = {
    x: region.x + random.int(0, Math.max(0, region.width - footprint.width)),
    y: region.y + random.int(0, Math.max(0, region.height - footprint.height)),
    width: footprint.width,
    height: footprint.height,
  };
  if (!fits(grid, rect, anchor, new Set()) || overlapsSolid(grid, rect)) {
    return undefined;
  }
  const cells = footprint.cells.map(cell => ({ x: rect.x + cell.x, y: rect.y + cell.y }));
  const grown = fillCells(grid, cells);
  if (!isConnected(grown, anchor)) {
    return undefined;
  }
  return {
    grid: grown,
    island: { kind, cells: new Set(cells.map(cell => keyOf(grid, cell))), bounds: rect },
  };
}

/**
 * The island with one more arm: a bar starting next to one of its cells
 * and running off, which turns a bar into an L, a T, a Z, a cross or a
 * stair. The island keeps its gap from every other and stays within its
 * box; every empty cell stays reachable from the tee. No row or column
 * crosses it twice, so it never wraps round a yard of its own — a U, a C
 * or a hook reads as a hollow the ball is trapped in — and no arm lies
 * along another so close that the two make a lump thicker than an island
 * may be (2026-10-10, both the user's call). Nothing when the arm does not
 * fit, and never for an islet.
 */
export function growIsland(
  random: Random,
  grid: CellGrid,
  island: Island,
  anchor: Cell,
  budget: number,
  limit: CellRect
): Placement | undefined {
  if (island.kind === 'islet') {
    return undefined;
  }
  const cell = cellOf(grid, random.pick([...island.cells]));
  const towards = random.pick(DIRECTIONS);
  const arm = armFrom(random, island, { x: cell.x + towards.x, y: cell.y + towards.y });
  const bounds = union(island.bounds, arm);
  if (
    !withinBox(bounds, island.kind) ||
    !contains(limit, arm) ||
    !fits(grid, arm, anchor, island.cells)
  ) {
    return undefined;
  }
  const added = cellsOf(grid, arm).filter(key => !island.cells.has(key));
  if (added.length === 0 || added.length > budget) {
    return undefined;
  }
  const cells = new Set([...island.cells, ...added]);
  if (!isOrthogonallyConvex(grid, cells) || isTooThick(grid, cells, added)) {
    return undefined;
  }
  const grown = fillRect(grid, arm);
  // The flood fill is the dear one: it goes last.
  if (
    hasNarrowSlot(grown, MIN_SLOT_CELLS, arm) ||
    hasDiagonalOnlyContact(grown, arm) ||
    !isConnected(grown, anchor)
  ) {
    return undefined;
  }
  return {
    grid: grown,
    island: { ...island, cells, bounds },
  };
}

function withinBox(bounds: CellRect, kind: IslandKind): boolean {
  const box = kind === 'giant' ? GIANT_BOX : BODY_BOX;
  return bounds.width <= box.width && bounds.height <= box.height;
}

/** Whether some square too big to lie inside an island is all island, one of the `added` cells in it. */
function isTooThick(grid: CellGrid, cells: ReadonlySet<number>, added: readonly number[]): boolean {
  const side = MAX_THICKNESS_CELLS + 1;
  const isIsland = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < grid.width && y < grid.height && cells.has(y * grid.width + x);
  const isSolidSquare = (left: number, bottom: number): boolean => {
    for (let y = bottom; y < bottom + side; y += 1) {
      for (let x = left; x < left + side; x += 1) {
        if (!isIsland(x, y)) {
          return false;
        }
      }
    }
    return true;
  };
  return added.some(key => {
    const { x, y } = cellOf(grid, key);
    for (let bottom = y - side + 1; bottom <= y; bottom += 1) {
      for (let left = x - side + 1; left <= x; left += 1) {
        if (isSolidSquare(left, bottom)) {
          return true;
        }
      }
    }
    return false;
  });
}

/** Whether every row and every column of the island is one unbroken run of its cells. */
function isOrthogonallyConvex(grid: CellGrid, cells: ReadonlySet<number>): boolean {
  const rows = new Map<number, Run>();
  const columns = new Map<number, Run>();
  for (const key of cells) {
    const { x, y } = cellOf(grid, key);
    rows.set(y, extend(rows.get(y), x));
    columns.set(x, extend(columns.get(x), y));
  }
  const unbroken = (run: Run): boolean => run.last - run.first + 1 === run.count;
  return [...rows.values()].every(unbroken) && [...columns.values()].every(unbroken);
}

interface Run {
  readonly first: number;
  readonly last: number;
  readonly count: number;
}

function extend(run: Run | undefined, at: number): Run {
  if (run === undefined) {
    return { first: at, last: at, count: 1 };
  }
  return {
    first: Math.min(run.first, at),
    last: Math.max(run.last, at),
    count: run.count + 1,
  };
}

function contains(outer: CellRect, inner: CellRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Which way the next arm runs: often along the island's longer side, otherwise any way. */
function armWay(random: Random, island: Island): Cell {
  if (!random.chance(ALONG_THE_LENGTH_CHANCE)) {
    return random.pick(DIRECTIONS);
  }
  const sign = random.chance(1 / 2) ? 1 : -1;
  return island.bounds.width >= island.bounds.height ? { x: sign, y: 0 } : { x: 0, y: sign };
}

/** A bar starting at `cell` and running a random length, `cell` on any of its rows. */
function armFrom(random: Random, island: Island, cell: Cell): CellRect {
  const along = armWay(random, island);
  const thin = random.chance(THIN_ARM_CHANCE);
  const thickness = thin ? THIN_ARM_THICKNESS : LIMB_THICKNESS;
  const longest = island.kind === 'giant' ? MAX_GIANT_ARM_LENGTH : MAX_ARM_LENGTH;
  const length = random.int(thin ? MIN_THIN_ARM_LENGTH : MIN_ARM_LENGTH, longest);
  const far = { x: cell.x + along.x * (length - 1), y: cell.y + along.y * (length - 1) };
  const horizontal = along.y === 0;
  const across = random.int(0, thickness - 1);
  return {
    x: Math.min(cell.x, far.x) - (horizontal ? 0 : across),
    y: Math.min(cell.y, far.y) - (horizontal ? across : 0),
    width: horizontal ? length : thickness,
    height: horizontal ? thickness : length,
  };
}

/**
 * Whether the rectangle lies on the board, leaves the tee cell free, and
 * stays the gap away from every solid cell other than the island's own.
 */
function fits(grid: CellGrid, rect: CellRect, anchor: Cell, own: ReadonlySet<number>): boolean {
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > grid.width ||
    rect.y + rect.height > grid.height
  ) {
    return false;
  }
  if (covers(rect, anchor)) {
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
