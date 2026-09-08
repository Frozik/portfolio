import type { Pickup, PickupShape } from '../level';
import type { Cell, CellGrid } from './cell-grid';
import { cellKey, isSolid } from './cell-grid';
import type { Random } from './random';

const MIN_PICKUPS = 3;
const MAX_PICKUPS = 8;
const HALF = 0.5;
const SHAPES: readonly PickupShape[] = ['diamond', 'square', 'ring'];

/** Pickups in the middle of empty cells nothing else uses — never two in one cell. */
export function placePickups(
  random: Random,
  grid: CellGrid,
  blocked: readonly Cell[]
): readonly Pickup[] {
  const taken = new Set(blocked.map(cell => cellKey(grid, cell)));
  const free: Cell[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (!isSolid(grid, x, y) && !taken.has(cellKey(grid, { x, y }))) {
        free.push({ x, y });
      }
    }
  }
  const count = Math.min(random.int(MIN_PICKUPS, MAX_PICKUPS), free.length);
  const pickups: Pickup[] = [];
  while (pickups.length < count) {
    const index = random.int(0, free.length - 1);
    const [cell] = free.splice(index, 1);
    pickups.push({ position: { x: cell.x + HALF, y: cell.y + HALF }, shape: random.pick(SHAPES) });
  }
  return pickups;
}
