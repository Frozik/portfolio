import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

const GRID_POINTS = 9;
const MIN_POINTS = 4;

export type TPatternProblem = 'too-short' | 'off-grid';

/**
 * The canonical code of a pattern drawn through points 0–8 (row by row): the points exactly as the
 * finger went through them, a point it came back to included, so the code is the line on the
 * screen. A finger resting on a point touches it once. Fewer than four different points is no
 * pattern.
 */
export function patternCode(touched: readonly number[]): TResult<string, TPatternProblem> {
  if (touched.some(point => !Number.isInteger(point) || point < 0 || point >= GRID_POINTS)) {
    return err('off-grid');
  }
  const points = touched.filter((point, index) => index === 0 || touched[index - 1] !== point);
  return new Set(points).size < MIN_POINTS ? err('too-short') : ok(`pattern:${points.join('-')}`);
}
