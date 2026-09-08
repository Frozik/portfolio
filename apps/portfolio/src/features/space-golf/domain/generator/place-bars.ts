import type { Wall } from '../level';
import { createChamferedBlock, createTriangle, createWall, type Corner } from '../walls';
import type { Cell, CellGrid } from './cell-grid';
import { cellKey, isBlock, isOutside, isSolid } from './cell-grid';
import { EDGE_BLEED_METERS } from './layout';
import type { Random } from './random';

/** The recording's thin bright bars: elastic on every face. */
const MIN_BARS = 0;
const MAX_BARS = 3;
const BAR_ATTEMPTS = 24;
const MIN_BAR_CELLS = 2;
const MAX_BAR_CELLS = 4;
const BAR_THICKNESS_METERS = 0.12;
/** A free end is cut at 45° like every other corner; the cut is small because the bar is thin. */
const BAR_END_CHAMFER_METERS = 0.05;
/** The fillets joining a bar to the block face it grows out of. */
const BAR_FILLET_METERS = 0.2;
const HALF = 0.5;
const LEFT_CORNERS: readonly Corner[] = ['lowerLeft', 'upperLeft'];
const RIGHT_CORNERS: readonly Corner[] = ['lowerRight', 'upperRight'];
const BOTTOM_CORNERS: readonly Corner[] = ['lowerLeft', 'lowerRight'];
const TOP_CORNERS: readonly Corner[] = ['upperLeft', 'upperRight'];

export interface PlacedBars {
  readonly walls: readonly Wall[];
  /** The cells the bars run through. */
  readonly cells: readonly Cell[];
}

/**
 * Thin elastic bars through the open space: each runs along a row or a
 * column of empty cells and grows out of a block face or in from the
 * board's edge; the far end is free or joined to another block.
 */
export function placeBars(random: Random, grid: CellGrid, blocked: readonly Cell[]): PlacedBars {
  const taken = new Set(blocked.map(cell => cellKey(grid, cell)));
  const walls: Wall[] = [];
  const cells: Cell[] = [];
  const wanted = random.int(MIN_BARS, MAX_BARS);
  let placed = 0;
  for (let attempt = 0; attempt < BAR_ATTEMPTS && placed < wanted; attempt += 1) {
    const horizontal = random.chance(HALF);
    const length = random.int(MIN_BAR_CELLS, MAX_BAR_CELLS);
    const start: Cell = horizontal
      ? { x: random.int(0, grid.width - length), y: random.int(0, grid.height - 1) }
      : { x: random.int(0, grid.width - 1), y: random.int(0, grid.height - length) };
    const run = Array.from({ length }, (_, index) =>
      horizontal ? { x: start.x + index, y: start.y } : { x: start.x, y: start.y + index }
    );
    if (run.some(cell => isSolid(grid, cell.x, cell.y) || taken.has(cellKey(grid, cell)))) {
      continue;
    }
    const before = horizontal ? { x: start.x - 1, y: start.y } : { x: start.x, y: start.y - 1 };
    const last = run[run.length - 1];
    const after = horizontal ? { x: last.x + 1, y: last.y } : { x: last.x, y: last.y + 1 };
    if (!isSolid(grid, before.x, before.y) && !isSolid(grid, after.x, after.y)) {
      continue;
    }
    walls.push(...barWalls(grid, horizontal, start, length, before, after));
    for (const cell of run) {
      taken.add(cellKey(grid, cell));
      cells.push(cell);
    }
    placed += 1;
  }
  return { walls, cells };
}

function barWalls(
  grid: CellGrid,
  horizontal: boolean,
  start: Cell,
  length: number,
  before: Cell,
  after: Cell
): readonly Wall[] {
  const along = horizontal ? start.x : start.y;
  const across = (horizontal ? start.y : start.x) + HALF;
  const low = isOutside(grid, before.x, before.y) ? along - EDGE_BLEED_METERS : along;
  const high = isOutside(grid, after.x, after.y)
    ? along + length + EDGE_BLEED_METERS
    : along + length;
  const half = BAR_THICKNESS_METERS / 2;
  const corners = new Set<Corner>();
  if (!isSolid(grid, before.x, before.y)) {
    for (const corner of horizontal ? LEFT_CORNERS : BOTTOM_CORNERS) {
      corners.add(corner);
    }
  }
  if (!isSolid(grid, after.x, after.y)) {
    for (const corner of horizontal ? RIGHT_CORNERS : TOP_CORNERS) {
      corners.add(corner);
    }
  }
  const bar = horizontal
    ? createChamferedBlock(
        low,
        across - half,
        high - low,
        BAR_THICKNESS_METERS,
        BAR_END_CHAMFER_METERS,
        corners
      )
    : createChamferedBlock(
        across - half,
        low,
        BAR_THICKNESS_METERS,
        high - low,
        BAR_END_CHAMFER_METERS,
        corners
      );
  const elastic = createWall(bar.vertices, new Set(bar.edges.map((_, index) => index)));
  const fillets: Wall[] = [];
  const c = BAR_FILLET_METERS;
  if (isBlock(grid, before.x, before.y)) {
    fillets.push(...junctionFillets(horizontal, low, across, half, c, 1));
  }
  if (isBlock(grid, after.x, after.y)) {
    fillets.push(...junctionFillets(horizontal, high, across, half, c, -1));
  }
  return [elastic, ...fillets];
}

/** Two triangles closing the right angles where a bar meets a block face at `along`; `into` points along the bar. */
function junctionFillets(
  horizontal: boolean,
  along: number,
  across: number,
  half: number,
  size: number,
  into: 1 | -1
): readonly Wall[] {
  const point = (a: number, b: number): { x: number; y: number } =>
    horizontal ? { x: a, y: b } : { x: b, y: a };
  return [
    createTriangle(
      point(along, across + half),
      point(along + into * size, across + half),
      point(along, across + half + size)
    ),
    createTriangle(
      point(along, across - half),
      point(along + into * size, across - half),
      point(along, across - half - size)
    ),
  ];
}
