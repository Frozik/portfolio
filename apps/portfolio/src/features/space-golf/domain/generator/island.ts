import type { Cell, CellGrid, CellRect } from './cell-grid';
import {
  fillRect,
  hasDiagonalOnlyContact,
  hasNarrowSlot,
  isConnected,
  isSolid,
  overlapsSolid,
} from './cell-grid';
import type { Random } from './random';

/**
 * The original's boards, read off eight screenshots (2026-09-18), mix three
 * kinds of island on the very half-metre module this grid has: long ones
 * framing the screen's edges, free-standing blocks and bars grown by arms
 * into an L, T, Z or stair, and lozenges and octagons a cell or two across.
 * The endless course has no edge to frame, so the first two are one kind
 * here: `body`, a block or a bar, short or long, grown by arms; `islet` is
 * never grown. Limbs are two cells thick, now and then one.
 */
export type IslandKind = 'body' | 'islet';

const LIMB_THICKNESS = 2;
const THIN_ARM_THICKNESS = 1;
const THIN_ARM_CHANCE = 0.2;
/** A thin arm is a long one: a short thin stub reads as a sliver. */
const MIN_THIN_ARM_LENGTH = 3;
const MIN_ARM_LENGTH = 2;
const MAX_ARM_LENGTH = 6;
/** No pocket or slot in an island is narrower than this many cells — a metre. */
const MIN_SLOT_CELLS = 2;
const BLOCK_CHANCE = 0.35;
const MIN_BLOCK_SIDE = 3;
const MAX_BLOCK_WIDTH = 5;
const MAX_BLOCK_HEIGHT = 4;
/** Bars run from short to the long framing shapes the original lays along its edges. */
const MIN_BAR_LENGTH = 3;
const MAX_BAR_LENGTH = 14;
const MAX_BODY_WIDTH = 16;
const MAX_BODY_HEIGHT = 14;
/** How often a body's arm runs along its longer side rather than any way. */
const ALONG_THE_LENGTH_CHANCE = 0.5;
/** An islet's footprint, in cells: lozenges a cell thick and small octagons. */
const ISLET_SIZES: readonly (readonly [width: number, height: number])[] = [
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [1, 3],
  [2, 2],
  [3, 2],
  [2, 3],
];
/** Empty cells kept between one island and the next — a metre and a half, ten ball widths — so there is room to fly between them (a metre until 2026-09-18). */
export const ISLAND_GAP_CELLS = 3;
const DIRECTIONS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

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
  const rect = seedOf(random, kind, region);
  if (!fits(grid, rect, anchor, new Set()) || overlapsSolid(grid, rect)) {
    return undefined;
  }
  const grown = fillRect(grid, rect);
  if (!isConnected(grown, anchor)) {
    return undefined;
  }
  return { grid: grown, island: { kind, cells: new Set(cellsOf(grown, rect)), bounds: rect } };
}

/**
 * The island with one more arm: a bar starting next to one of its cells
 * and running off, which turns a bar into an L, a T, a U, a Z or a stair
 * or a long bar into a C. The island keeps its gap from every other and
 * stays within its box; every empty cell stays reachable from the tee.
 * Nothing when the arm does not fit, and never for an islet.
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
  if (!withinBox(bounds) || !contains(limit, arm) || !fits(grid, arm, anchor, island.cells)) {
    return undefined;
  }
  const added = cellsOf(grid, arm).filter(key => !island.cells.has(key));
  if (added.length === 0 || added.length > budget) {
    return undefined;
  }
  const grown = fillRect(grid, arm);
  // The flood fill is the dear one: it goes last.
  if (
    hasNarrowSlot(grown, MIN_SLOT_CELLS, arm) ||
    hasDiagonalOnlyContact(grown) ||
    !isConnected(grown, anchor)
  ) {
    return undefined;
  }
  return {
    grid: grown,
    island: { ...island, cells: new Set([...island.cells, ...added]), bounds },
  };
}

function seedOf(random: Random, kind: IslandKind, region: CellRect): CellRect {
  const [width, height] = kind === 'islet' ? random.pick(ISLET_SIZES) : bodySize(random);
  return {
    x: region.x + random.int(0, Math.max(0, region.width - width)),
    y: region.y + random.int(0, Math.max(0, region.height - height)),
    width,
    height,
  };
}

/** A chunky block, or a bar two cells thick. */
function bodySize(random: Random): readonly [width: number, height: number] {
  const block = random.chance(BLOCK_CHANCE);
  const horizontal = random.chance(1 / 2);
  const length = block
    ? random.int(MIN_BLOCK_SIDE, MAX_BLOCK_WIDTH)
    : random.int(MIN_BAR_LENGTH, MAX_BAR_LENGTH);
  const thickness = block ? random.int(MIN_BLOCK_SIDE, MAX_BLOCK_HEIGHT) : LIMB_THICKNESS;
  return horizontal ? [length, thickness] : [thickness, length];
}

function withinBox(bounds: CellRect): boolean {
  return bounds.width <= MAX_BODY_WIDTH && bounds.height <= MAX_BODY_HEIGHT;
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
  const length = random.int(thin ? MIN_THIN_ARM_LENGTH : MIN_ARM_LENGTH, MAX_ARM_LENGTH);
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
