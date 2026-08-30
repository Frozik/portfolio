import { isNil } from 'lodash-es';

import type { Meters } from '../units';
import type { ElevationSample } from './elevation-sample';

/** Elevation of a fitted surface at any plan point. */
export type ElevationSurface = (x: Meters, y: Meters) => Meters;

/** The affine tail `a₀ + a₁·x + a₂·y` the kernel expansion is built on top of. */
const AFFINE_TERM_COUNT = 3;

/**
 * Perpendicular distance under which a mark counts as lying on the line through
 * the others. Marks that near a common line say nothing about the ground across
 * it: the affine block of the system loses its rank and the weights come out as
 * numerical noise, so the caller is better served by the line fallback.
 */
const COLLINEARITY_TOLERANCE_METERS: Meters = 0.01;

/**
 * How small a pivot may be, as a fraction of the system's largest coefficient,
 * before the elimination counts as having failed. Relative rather than absolute
 * because the kernel block scales with the square of the plot's size, so an
 * absolute floor would either pass singular systems on a large plot or reject
 * sound ones on a small plot.
 */
const SINGULAR_PIVOT_RATIO = 1e-10;

/**
 * The thin-plate spline through `samples` — the interpolant that minimises the
 * bending energy of a thin metal sheet pinned at every mark, and the default
 * kernel of `scipy`'s `RBFInterpolator`, of ArcGIS Topo-to-Raster and of GRASS
 * `v.surf.rst`:
 *
 *     f(x, y) = Σ wᵢ·φ(‖(x, y) − pᵢ‖) + a₀ + a₁·x + a₂·y,   φ(r) = r²·log r
 *
 * The weights follow from the interpolation conditions plus the three natural
 * side conditions Σwᵢ = Σwᵢxᵢ = Σwᵢyᵢ = 0, which is one dense (N + 3)² system
 * solved once here; evaluating a grid afterwards costs one pass over the marks
 * per node.
 *
 * The affine tail is what makes the surface reproduce a plane exactly — with all
 * weights zero — however the marks are laid out, inside their hull and outside
 * it alike. That is the property a triangulated surface only has inside the hull,
 * and it is why two marks at one level no longer trap a trench between them.
 *
 * `undefined` when there is no such surface to fit: fewer than three marks, or
 * marks that all share a line. The caller falls back to a profile along that
 * line.
 */
export function fitThinPlateSpline(
  samples: readonly ElevationSample[]
): ElevationSurface | undefined {
  const count = samples.length;

  if (count < AFFINE_TERM_COUNT || !spansAnArea(samples)) {
    return undefined;
  }

  const solution = solveSpline(samples);

  if (isNil(solution)) {
    return undefined;
  }

  const pointsX = Float64Array.from(samples, sample => sample.position.x);
  const pointsY = Float64Array.from(samples, sample => sample.position.y);
  const weights = solution.subarray(0, count);
  const constantTerm = solution[count];
  const xSlope = solution[count + 1];
  const ySlope = solution[count + 2];

  return (x, y) => {
    let elevation = constantTerm + xSlope * x + ySlope * y;

    for (let index = 0; index < count; index += 1) {
      const offsetX = x - pointsX[index];
      const offsetY = y - pointsY[index];

      elevation += weights[index] * kernel(offsetX * offsetX + offsetY * offsetY);
    }

    return elevation;
  };
}

/**
 * The radial kernel r²·log r, taken on the squared distance: `½·d²·ln d²` is the
 * same number without the square root, which halves the work of the innermost
 * loop of a quarter of a million grid nodes. It vanishes at the mark itself,
 * where the logarithm would otherwise run to −∞.
 */
function kernel(distanceSquared: number): number {
  return distanceSquared === 0 ? 0 : 0.5 * distanceSquared * Math.log(distanceSquared);
}

/**
 * Whether the marks enclose an area rather than a line. The farthest mark from
 * the first fixes a baseline, and any mark off that baseline by more than the
 * tolerance gives the affine block its third independent row.
 */
function spansAnArea(samples: readonly ElevationSample[]): boolean {
  const origin = samples[0].position;
  let baselineX = 0;
  let baselineY = 0;
  let baselineLengthSquared = 0;

  for (const sample of samples) {
    const offsetX = sample.position.x - origin.x;
    const offsetY = sample.position.y - origin.y;
    const lengthSquared = offsetX * offsetX + offsetY * offsetY;

    if (lengthSquared > baselineLengthSquared) {
      baselineLengthSquared = lengthSquared;
      baselineX = offsetX;
      baselineY = offsetY;
    }
  }

  if (baselineLengthSquared === 0) {
    return false;
  }

  const baselineLength = Math.sqrt(baselineLengthSquared);

  return samples.some(sample => {
    const offsetX = sample.position.x - origin.x;
    const offsetY = sample.position.y - origin.y;

    return (
      Math.abs(offsetX * baselineY - offsetY * baselineX) / baselineLength >
      COLLINEARITY_TOLERANCE_METERS
    );
  });
}

/**
 * The (N + 3) unknowns of the spline: N kernel weights followed by the three
 * affine coefficients.
 *
 *     ⎡ K  P ⎤ ⎡w⎤   ⎡z⎤
 *     ⎣ Pᵀ 0 ⎦ ⎣a⎦ = ⎣0⎦,   K[i][j] = φ(‖pᵢ − pⱼ‖),  P[i] = [1, xᵢ, yᵢ]
 */
function solveSpline(samples: readonly ElevationSample[]): Float64Array | undefined {
  const count = samples.length;
  const size = count + AFFINE_TERM_COUNT;
  const matrix: Float64Array[] = [];

  for (let row = 0; row < size; row += 1) {
    matrix.push(new Float64Array(size));
  }

  const rightHandSide = new Float64Array(size);

  for (let row = 0; row < count; row += 1) {
    const point = samples[row].position;

    for (let column = row + 1; column < count; column += 1) {
      const other = samples[column].position;
      const offsetX = point.x - other.x;
      const offsetY = point.y - other.y;
      const value = kernel(offsetX * offsetX + offsetY * offsetY);

      matrix[row][column] = value;
      matrix[column][row] = value;
    }

    matrix[row][count] = 1;
    matrix[row][count + 1] = point.x;
    matrix[row][count + 2] = point.y;
    matrix[count][row] = 1;
    matrix[count + 1][row] = point.x;
    matrix[count + 2][row] = point.y;
    rightHandSide[row] = samples[row].elevation;
  }

  return solveLinearSystem(matrix, rightHandSide);
}

/**
 * Gaussian elimination with partial pivoting. Both arguments are consumed in
 * place. `undefined` when the system turns out to be singular — a vanishing
 * pivot, or a back substitution that leaves the finite numbers behind.
 *
 * The saddle-point system a spline produces is symmetric but indefinite, so the
 * Cholesky factorisation that would otherwise be the obvious choice does not
 * apply; pivoting is what keeps the elimination stable on it.
 */
function solveLinearSystem(
  matrix: Float64Array[],
  rightHandSide: Float64Array
): Float64Array | undefined {
  const size = rightHandSide.length;
  let largestCoefficient = 0;

  for (const row of matrix) {
    for (const value of row) {
      largestCoefficient = Math.max(largestCoefficient, Math.abs(value));
    }
  }

  const minimumPivot = largestCoefficient * SINGULAR_PIVOT_RATIO;

  for (let step = 0; step < size; step += 1) {
    let pivotRowIndex = step;
    let pivotMagnitude = Math.abs(matrix[step][step]);

    for (let row = step + 1; row < size; row += 1) {
      const magnitude = Math.abs(matrix[row][step]);

      if (magnitude > pivotMagnitude) {
        pivotMagnitude = magnitude;
        pivotRowIndex = row;
      }
    }

    if (pivotMagnitude <= minimumPivot) {
      return undefined;
    }

    if (pivotRowIndex !== step) {
      const displacedRow = matrix[step];
      const displacedValue = rightHandSide[step];

      matrix[step] = matrix[pivotRowIndex];
      matrix[pivotRowIndex] = displacedRow;
      rightHandSide[step] = rightHandSide[pivotRowIndex];
      rightHandSide[pivotRowIndex] = displacedValue;
    }

    const pivotRow = matrix[step];
    const pivot = pivotRow[step];

    for (let row = step + 1; row < size; row += 1) {
      const currentRow = matrix[row];
      const factor = currentRow[step] / pivot;

      if (factor === 0) {
        continue;
      }

      currentRow[step] = 0;

      for (let column = step + 1; column < size; column += 1) {
        currentRow[column] -= factor * pivotRow[column];
      }

      rightHandSide[row] -= factor * rightHandSide[step];
    }
  }

  const solution = new Float64Array(size);

  for (let row = size - 1; row >= 0; row -= 1) {
    const currentRow = matrix[row];
    let residual = rightHandSide[row];

    for (let column = row + 1; column < size; column += 1) {
      residual -= currentRow[column] * solution[column];
    }

    const value = residual / currentRow[row];

    if (!Number.isFinite(value)) {
      return undefined;
    }

    solution[row] = value;
  }

  return solution;
}
