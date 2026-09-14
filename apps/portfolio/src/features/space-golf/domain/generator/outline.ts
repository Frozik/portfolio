import type { Cell, CellGrid } from './cell-grid';
import { isBlock } from './cell-grid';

/**
 * The outline of every island — every connected group of solid cells — as a
 * counter-clockwise loop of corner points with the solid on the left, the
 * points where the outline turns only. The space beyond the board is not
 * solid, so an island at the edge is outlined along the edge. Relies on the
 * layout rejecting cells that touch only at a corner: then every corner
 * point has at most one way out and the loops are unambiguous.
 */
export function traceOutlines(grid: CellGrid): readonly (readonly Cell[])[] {
  const columns = grid.width + 1;
  const keyOf = (point: Cell): number => point.y * columns + point.x;
  const next = new Map<number, Cell>();
  const link = (from: Cell, to: Cell): void => {
    next.set(keyOf(from), to);
  };
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (!isBlock(grid, x, y)) {
        continue;
      }
      if (!isBlock(grid, x, y - 1)) {
        link({ x, y }, { x: x + 1, y });
      }
      if (!isBlock(grid, x + 1, y)) {
        link({ x: x + 1, y }, { x: x + 1, y: y + 1 });
      }
      if (!isBlock(grid, x, y + 1)) {
        link({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
      }
      if (!isBlock(grid, x - 1, y)) {
        link({ x, y: y + 1 }, { x, y });
      }
    }
  }

  const loops: Cell[][] = [];
  while (next.size > 0) {
    const [startKey, first] = next.entries().next().value as [number, Cell];
    const loop: Cell[] = [];
    let key = startKey;
    let point = first;
    do {
      loop.push(point);
      next.delete(key);
      key = keyOf(point);
      const following = next.get(key);
      if (following === undefined) {
        break;
      }
      point = following;
    } while (key !== startKey);
    loops.push(startAtLowestLeft(dropCollinear(loop)));
  }
  return loops;
}

function dropCollinear(loop: readonly Cell[]): Cell[] {
  return loop.filter((point, index) => {
    const before = loop[(index - 1 + loop.length) % loop.length];
    const after = loop[(index + 1) % loop.length];
    const straight =
      (before.x === point.x && point.x === after.x) ||
      (before.y === point.y && point.y === after.y);
    return !straight;
  });
}

/** The same loop begun at its lowest, then leftmost, corner — so equal islands read alike. */
function startAtLowestLeft(loop: readonly Cell[]): Cell[] {
  let start = 0;
  loop.forEach((point, index) => {
    const lowest = loop[start];
    if (point.y < lowest.y || (point.y === lowest.y && point.x < lowest.x)) {
      start = index;
    }
  });
  return [...loop.slice(start), ...loop.slice(0, start)];
}
