import type { IAxisDomain } from '../viewport/axis-domain';

/** Index of the first position not before `target`, in a sorted column. */
export function lowerBound<TX>(
  domain: IAxisDomain<TX>,
  positions: ArrayLike<TX>,
  length: number,
  target: TX
): number {
  let low = 0;
  let high = length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (domain.compare(positions[middle], target) < 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/** Index of the first position after `target`, in a sorted column. */
export function upperBound<TX>(
  domain: IAxisDomain<TX>,
  positions: ArrayLike<TX>,
  length: number,
  target: TX
): number {
  let low = 0;
  let high = length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (domain.compare(positions[middle], target) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}
