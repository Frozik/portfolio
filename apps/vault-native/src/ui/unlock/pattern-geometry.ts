export const PATTERN_SIDE = 3;
/** How close to a point's centre a finger must pass to join it, as a share of the cell. */
const CATCH_SHARE = 0.3;

/** The point under a finger at a position on a pad of this side, or `null` between points and outside. */
export function pointAt(x: number, y: number, size: number): number | null {
  const cell = size / PATTERN_SIDE;
  const column = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  if (column < 0 || column >= PATTERN_SIDE || row < 0 || row >= PATTERN_SIDE) {
    return null;
  }
  const dx = x - (column + 0.5) * cell;
  const dy = y - (row + 0.5) * cell;
  return Math.hypot(dx, dy) <= cell * CATCH_SHARE ? row * PATTERN_SIDE + column : null;
}
