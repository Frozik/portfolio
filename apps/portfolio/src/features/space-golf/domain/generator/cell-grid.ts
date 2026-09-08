import type { Random } from './random';

/** A boolean grid of one-metre cells: `true` is solid. Row 0 is the bottom. */
export interface CellGrid {
  readonly width: number;
  readonly height: number;
  readonly solid: readonly boolean[];
}

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface CellRect extends Cell {
  readonly width: number;
  readonly height: number;
}

/** Whether the cell is solid; the space beyond the board counts as solid, so nothing is laid out there. */
export function isSolid(grid: CellGrid, x: number, y: number): boolean {
  return isOutside(grid, x, y) || grid.solid[y * grid.width + x];
}

/** Whether the cell is a solid cell of the board itself — the space beyond it is not a block. */
export function isBlock(grid: CellGrid, x: number, y: number): boolean {
  return !isOutside(grid, x, y) && grid.solid[y * grid.width + x];
}

export function isOutside(grid: CellGrid, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= grid.width || y >= grid.height;
}

export function cellKey(grid: CellGrid, cell: Cell): number {
  return cell.y * grid.width + cell.x;
}

export function createEmptyGrid(width: number, height: number): CellGrid {
  return { width, height, solid: new Array<boolean>(width * height).fill(false) };
}

export function fillRect(grid: CellGrid, rect: CellRect): CellGrid {
  const solid = [...grid.solid];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      solid[y * grid.width + x] = true;
    }
  }
  return { ...grid, solid };
}

const NEIGHBOURS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Whether every empty cell can be walked to from `from` through empty cells. */
export function isConnected(grid: CellGrid, from: Cell): boolean {
  const seen = new Set<number>();
  const queue: Cell[] = [from];
  seen.add(from.y * grid.width + from.x);
  while (queue.length > 0) {
    const cell = queue.pop();
    if (cell === undefined) {
      break;
    }
    for (const delta of NEIGHBOURS) {
      const next = { x: cell.x + delta.x, y: cell.y + delta.y };
      const key = next.y * grid.width + next.x;
      if (!isSolid(grid, next.x, next.y) && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  const emptyCount = grid.solid.filter(cell => !cell).length;
  return seen.size === emptyCount;
}

/** Whether the rectangle overlaps a solid cell or leaves the grid. */
export function overlapsSolid(grid: CellGrid, rect: CellRect): boolean {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (isSolid(grid, x, y)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Whether two solid cells touch only at a corner, with both cells between
 * them empty. Such a point contact leaves no room for a 45° junction, so
 * layouts with one are rejected.
 */
export function hasDiagonalOnlyContact(grid: CellGrid): boolean {
  for (let y = 0; y < grid.height - 1; y += 1) {
    for (let x = 0; x < grid.width - 1; x += 1) {
      const lowerLeft = isBlock(grid, x, y);
      const lowerRight = isBlock(grid, x + 1, y);
      const upperLeft = isBlock(grid, x, y + 1);
      const upperRight = isBlock(grid, x + 1, y + 1);
      if (
        (lowerLeft && upperRight && !lowerRight && !upperLeft) ||
        (lowerRight && upperLeft && !lowerLeft && !upperRight)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Maximal axis-aligned rectangles covering the solid cells: horizontal runs
 * per row, merged upwards while the run above is identical. Every solid cell
 * belongs to exactly one rectangle.
 */
export function solidRectangles(grid: CellGrid): readonly CellRect[] {
  const claimed = new Array<boolean>(grid.width * grid.height).fill(false);
  const rects: CellRect[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (!isSolid(grid, x, y) || claimed[y * grid.width + x]) {
        continue;
      }
      let width = 0;
      while (
        x + width < grid.width &&
        isSolid(grid, x + width, y) &&
        !claimed[y * grid.width + x + width]
      ) {
        width += 1;
      }
      let height = 1;
      while (y + height < grid.height && rowRunIsSolid(grid, claimed, x, y + height, width)) {
        height += 1;
      }
      for (let row = y; row < y + height; row += 1) {
        for (let column = x; column < x + width; column += 1) {
          claimed[row * grid.width + column] = true;
        }
      }
      rects.push({ x, y, width, height });
    }
  }
  return rects;
}

function rowRunIsSolid(
  grid: CellGrid,
  claimed: readonly boolean[],
  x: number,
  y: number,
  width: number
): boolean {
  for (let column = x; column < x + width; column += 1) {
    if (!isSolid(grid, column, y) || claimed[y * grid.width + column]) {
      return false;
    }
  }
  return true;
}

/** A random rectangle fully inside the grid. */
export function randomRect(
  random: Random,
  grid: CellGrid,
  maxWidth: number,
  maxHeight: number
): CellRect {
  const width = random.int(1, maxWidth);
  const height = random.int(1, maxHeight);
  return {
    x: random.int(0, grid.width - width),
    y: random.int(0, grid.height - height),
    width,
    height,
  };
}
