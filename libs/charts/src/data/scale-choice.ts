/**
 * Index of the finest step at which one element gets at least
 * `pixelsPerElement` pixels; the coarsest when none does (§4.3).
 * `steps` are in axis units, ascending.
 */
export function chooseScale(
  steps: readonly number[],
  unitsPerPixel: number,
  pixelsPerElement: number
): number {
  const fitting = steps.findIndex(step => step / unitsPerPixel >= pixelsPerElement);
  return fitting === -1 ? steps.length - 1 : fitting;
}
