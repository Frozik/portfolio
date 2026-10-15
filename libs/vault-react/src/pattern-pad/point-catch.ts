/** How close to a point's centre the pointer must pass to join it, as a share of its cell. */
const CATCH_SHARE = 0.3;

/**
 * Whether the pointer at (x, y) joins the point drawn in this cell: only near its centre, so a
 * line drawn past a point to the next does not catch the neighbours whose cells it crosses.
 */
export function catchesPoint(
  cell: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  x: number,
  y: number
): boolean {
  const dx = x - (cell.left + cell.width / 2);
  const dy = y - (cell.top + cell.height / 2);
  return Math.hypot(dx, dy) <= Math.min(cell.width, cell.height) * CATCH_SHARE;
}
