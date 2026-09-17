import { assertNever } from '@frozik/utils/assert/assertNever';

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
 * kinds of island on the very half-metre module this grid has:
 * `shore`: a long spine two cells thick lying along the board's edge, with
 * arms reaching into the board — the L and C shapes that frame a level;
 * `body`: a free-standing block or bar grown by arms into an L, T, Z or
 * stair; `islet`: a lozenge or an octagon a cell or two across, never
 * grown. Limbs are two cells thick, now and then one.
 */
export type IslandKind = 'shore' | 'body' | 'islet';

const LIMB_THICKNESS = 2;
const THIN_ARM_THICKNESS = 1;
const THIN_ARM_CHANCE = 0.2;
/** A thin arm is a long one: a short thin stub reads as a sliver. */
const MIN_THIN_ARM_LENGTH = 3;
const MIN_ARM_LENGTH = 2;
const MAX_ARM_LENGTH = 6;
const MIN_SHORE_LENGTH = 6;
const MAX_SHORE_LENGTH = 16;
/** A shore's arms reach further into the board than a body's. */
const MAX_SHORE_ARM_LENGTH = 6;
/** How far from the edge a shore may reach, in cells. */
const MAX_SHORE_DEPTH = 7;
const INWARD_ARM_CHANCE = 0.6;
/** No pocket or slot in an island is narrower than this many cells — a metre. */
const MIN_SLOT_CELLS = 2;
const BLOCK_CHANCE = 0.35;
const MIN_BLOCK_SIDE = 3;
const MAX_BLOCK_WIDTH = 5;
const MAX_BLOCK_HEIGHT = 4;
const MIN_BAR_LENGTH = 3;
const MAX_BAR_LENGTH = 7;
const MAX_BODY_WIDTH = 12;
const MAX_BODY_HEIGHT = 10;
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
const ISLAND_GAP_CELLS = 3;
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
  /** For a shore: which way the board lies from the edge it runs along. */
  readonly inward: Cell | undefined;
}

export interface Placement {
  readonly grid: CellGrid;
  readonly island: Island;
}

interface Seed {
  readonly rect: CellRect;
  readonly inward: Cell | undefined;
}

/** A new island of the given kind, the gap away from everything else. Nothing when it has no room. */
export function seedIsland(
  random: Random,
  grid: CellGrid,
  teeCell: Cell,
  kind: IslandKind
): Placement | undefined {
  const seed = seedOf(random, grid, kind);
  if (!fits(grid, seed.rect, teeCell, new Set()) || overlapsSolid(grid, seed.rect)) {
    return undefined;
  }
  const grown = fillRect(grid, seed.rect);
  if (!isConnected(grown, teeCell)) {
    return undefined;
  }
  return {
    grid: grown,
    island: {
      kind,
      cells: new Set(cellsOf(grown, seed.rect)),
      bounds: seed.rect,
      inward: seed.inward,
    },
  };
}

/**
 * The island with one more arm: a bar starting next to one of its cells
 * and running off, which turns a bar into an L, a T, a U, a Z or a stair
 * and a shore into a C. The island keeps its gap from every other and
 * stays within its box; every empty cell stays reachable from the tee.
 * Nothing when the arm does not fit, and never for an islet.
 */
export function growIsland(
  random: Random,
  grid: CellGrid,
  island: Island,
  teeCell: Cell,
  budget: number
): Placement | undefined {
  if (island.kind === 'islet') {
    return undefined;
  }
  const cell = cellOf(grid, random.pick([...island.cells]));
  const towards = random.pick(DIRECTIONS);
  const arm = armFrom(random, island, { x: cell.x + towards.x, y: cell.y + towards.y });
  const bounds = union(island.bounds, arm);
  if (!withinBox(island, bounds) || !fits(grid, arm, teeCell, island.cells)) {
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
    !isConnected(grown, teeCell)
  ) {
    return undefined;
  }
  return {
    grid: grown,
    island: { ...island, cells: new Set([...island.cells, ...added]), bounds },
  };
}

function seedOf(random: Random, grid: CellGrid, kind: IslandKind): Seed {
  switch (kind) {
    case 'shore':
      return shoreSeed(random, grid);
    case 'body':
      return { rect: bodySeed(random, grid), inward: undefined };
    case 'islet': {
      const [width, height] = random.pick(ISLET_SIZES);
      return {
        rect: {
          x: random.int(0, grid.width - width),
          y: random.int(0, grid.height - height),
          width,
          height,
        },
        inward: undefined,
      };
    }
    default:
      return assertNever(kind);
  }
}

/** A spine flush with one of the board's four edges, somewhere along it. */
function shoreSeed(random: Random, grid: CellGrid): Seed {
  const inward = random.pick(DIRECTIONS);
  const vertical = inward.x !== 0;
  const side = vertical ? grid.height : grid.width;
  const length = random.int(MIN_SHORE_LENGTH, Math.min(MAX_SHORE_LENGTH, side));
  const along = random.int(0, side - length);
  const flush = (extent: number, way: number): number => (way > 0 ? 0 : extent - LIMB_THICKNESS);
  return {
    inward,
    rect: vertical
      ? { x: flush(grid.width, inward.x), y: along, width: LIMB_THICKNESS, height: length }
      : { x: along, y: flush(grid.height, inward.y), width: length, height: LIMB_THICKNESS },
  };
}

/** A chunky block, or a bar two cells thick, anywhere on the board. */
function bodySeed(random: Random, grid: CellGrid): CellRect {
  const block = random.chance(BLOCK_CHANCE);
  const horizontal = random.chance(1 / 2);
  const length = block
    ? random.int(MIN_BLOCK_SIDE, MAX_BLOCK_WIDTH)
    : random.int(MIN_BAR_LENGTH, MAX_BAR_LENGTH);
  const thickness = block ? random.int(MIN_BLOCK_SIDE, MAX_BLOCK_HEIGHT) : LIMB_THICKNESS;
  const width = horizontal ? length : thickness;
  const height = horizontal ? thickness : length;
  return {
    x: random.int(0, Math.max(0, grid.width - width)),
    y: random.int(0, Math.max(0, grid.height - height)),
    width,
    height,
  };
}

/** A shore stays within its depth from the edge, however long; a body within its box. */
function withinBox(island: Island, bounds: CellRect): boolean {
  if (island.inward === undefined) {
    return bounds.width <= MAX_BODY_WIDTH && bounds.height <= MAX_BODY_HEIGHT;
  }
  return (island.inward.x !== 0 ? bounds.width : bounds.height) <= MAX_SHORE_DEPTH;
}

/** Which way the next arm runs: a shore's mostly into the board, a body's often along its longer side. */
function armWay(random: Random, island: Island): Cell {
  if (island.inward !== undefined) {
    return random.chance(INWARD_ARM_CHANCE) ? island.inward : random.pick(DIRECTIONS);
  }
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
  const length = random.int(
    thin ? MIN_THIN_ARM_LENGTH : MIN_ARM_LENGTH,
    island.inward === undefined ? MAX_ARM_LENGTH : MAX_SHORE_ARM_LENGTH
  );
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
