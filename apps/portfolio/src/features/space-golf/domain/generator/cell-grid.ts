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

function isOutside(grid: CellGrid, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= grid.width || y >= grid.height;
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
