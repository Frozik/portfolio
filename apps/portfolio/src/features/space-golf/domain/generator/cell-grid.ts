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

/**
 * Whether every empty cell can be walked to from `from` through empty cells.
 * Runs for every arm an island tries to grow, so it works on flat arrays
 * of cell keys rather than on sets and cell objects.
 */
export function isConnected(grid: CellGrid, from: Cell): boolean {
  const { width, height, solid } = grid;
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let top = 0;
  let reached = 1;
  const start = from.y * width + from.x;
  seen[start] = 1;
  stack[top] = start;
  top += 1;
  while (top > 0) {
    top -= 1;
    const key = stack[top];
    const x = key % width;
    const y = (key - x) / width;
    for (const delta of NEIGHBOURS) {
      const nextX = x + delta.x;
      const nextY = y + delta.y;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        continue;
      }
      const next = nextY * width + nextX;
      if (!solid[next] && seen[next] === 0) {
        seen[next] = 1;
        reached += 1;
        stack[top] = next;
        top += 1;
      }
    }
  }
  let emptyCount = 0;
  for (let key = 0; key < solid.length; key += 1) {
    emptyCount += solid[key] ? 0 : 1;
  }
  return reached === emptyCount;
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
 * Whether some run of empty cells between two blocks — along a row or a
 * column — is shorter than `minCells`: a slot too narrow to be a passage,
 * the comb the original's islands never show. Runs that end at the board's
 * edge are open space, not slots. Only the rows and columns crossing
 * `within` are looked at: a new slot can only open where cells were added.
 */
export function hasNarrowSlot(grid: CellGrid, minCells: number, within: CellRect): boolean {
  const scan = (length: number, solidAt: (index: number) => boolean): boolean => {
    let run = -1;
    for (let index = 0; index < length; index += 1) {
      if (solidAt(index)) {
        if (run > 0 && run < minCells) {
          return true;
        }
        run = 0;
      } else if (run >= 0) {
        run += 1;
      }
    }
    return false;
  };
  for (let y = within.y; y < within.y + within.height; y += 1) {
    if (scan(grid.width, x => isBlock(grid, x, y))) {
      return true;
    }
  }
  for (let x = within.x; x < within.x + within.width; x += 1) {
    if (scan(grid.height, y => isBlock(grid, x, y))) {
      return true;
    }
  }
  return false;
}
