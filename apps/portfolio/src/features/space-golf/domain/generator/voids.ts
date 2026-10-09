import type { Cell, CellGrid, CellRect } from './cell-grid';
import { isBlock } from './cell-grid';

export interface Void {
  readonly cell: Cell;
  /** Steps to the nearest land, diagonal steps counting one. */
  readonly reach: number;
}

const STEPS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/**
 * The cell of `region` farthest from every solid cell of the grid, cells
 * within `reach` of a `spared` one left out; on a grid with no land at all
 * every cell is as far as the window is wide. Nothing when every empty cell
 * is spared.
 */
export function widestVoid(
  land: CellGrid,
  region: CellRect,
  spared: readonly Cell[],
  reach: number
): Void | undefined {
  const distances = distancesToLand(land);
  let widest: Void | undefined;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const distance = distances[y * land.width + x];
      const isSpared = spared.some(
        cell => Math.max(Math.abs(cell.x - x), Math.abs(cell.y - y)) <= reach
      );
      if (distance > 0 && !isSpared && (widest === undefined || distance > widest.reach)) {
        widest = { cell: { x, y }, reach: distance };
      }
    }
  }
  return widest;
}

/** Breadth-first from every solid cell at once, so each cell gets its distance to the nearest. */
function distancesToLand(land: CellGrid): Int32Array {
  const { width, height } = land;
  const unreached = width + height;
  const distances = new Int32Array(width * height).fill(unreached);
  const queue = new Int32Array(width * height);
  let tail = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isBlock(land, x, y)) {
        distances[y * width + x] = 0;
        queue[tail] = y * width + x;
        tail += 1;
      }
    }
  }
  for (let head = 0; head < tail; head += 1) {
    const key = queue[head];
    const x = key % width;
    const y = (key - x) / width;
    for (const step of STEPS) {
      const nextX = x + step.x;
      const nextY = y + step.y;
      const next = nextY * width + nextX;
      if (
        nextX >= 0 &&
        nextY >= 0 &&
        nextX < width &&
        nextY < height &&
        distances[next] === unreached
      ) {
        distances[next] = distances[key] + 1;
        queue[tail] = next;
        tail += 1;
      }
    }
  }
  return distances;
}
