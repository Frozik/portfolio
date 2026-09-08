/** Wraps an angle into [−π, π). */
export function wrapToHalfTurn(angle: number): number {
  return angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
}
