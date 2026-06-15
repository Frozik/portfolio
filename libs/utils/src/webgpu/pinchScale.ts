/**
 * Below this finger separation (in pixels) a pinch gesture is treated as
 * degenerate: dividing by such a tiny `currentDistance` would yield a runaway
 * (or infinite) zoom factor, so callers skip the frame instead.
 */
export const PINCH_MIN_DISTANCE_PX = 1;

/** Euclidean distance between two pointers in client-pixel space. */
export function pointerDistance(
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number
): number {
  const deltaX = firstX - secondX;
  const deltaY = firstY - secondY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * Pinch-zoom scale factor for a two-finger gesture: how much the view should
 * scale given the previous and current finger separation.
 *
 * Returns `null` when `currentDistance` is below {@link PINCH_MIN_DISTANCE_PX},
 * guarding against the divide-by-zero that would otherwise produce an `Infinity`
 * scale (fingers reported at the same point). Callers should skip the gesture
 * frame when this returns `null`.
 */
export function computePinchScale(
  previousDistance: number,
  currentDistance: number
): number | null {
  if (currentDistance < PINCH_MIN_DISTANCE_PX) {
    return null;
  }
  return previousDistance / currentDistance;
}
