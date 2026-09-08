import { assert } from '@frozik/utils/assert/assert';

/**
 * Solves `matrix · x = rightHandSide` for a symmetric positive-definite
 * matrix by Cholesky factorisation. The chain's mass matrix is always SPD, so
 * no pivoting is needed and the factorisation cannot fail on real input.
 */
export function solveSymmetricPositiveDefinite(
  matrix: readonly (readonly number[])[],
  rightHandSide: readonly number[]
): number[] {
  const size = rightHandSide.length;
  const lower: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));

  for (let row = 0; row < size; row++) {
    for (let column = 0; column <= row; column++) {
      let sum = matrix[row][column];
      for (let inner = 0; inner < column; inner++) {
        sum -= lower[row][inner] * lower[column][inner];
      }

      if (row === column) {
        assert(sum > 0, 'Matrix is not positive definite');
        lower[row][row] = Math.sqrt(sum);
      } else {
        lower[row][column] = sum / lower[column][column];
      }
    }
  }

  const forward = new Array<number>(size).fill(0);
  for (let row = 0; row < size; row++) {
    let sum = rightHandSide[row];
    for (let inner = 0; inner < row; inner++) {
      sum -= lower[row][inner] * forward[inner];
    }
    forward[row] = sum / lower[row][row];
  }

  const solution = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row--) {
    let sum = forward[row];
    for (let inner = row + 1; inner < size; inner++) {
      sum -= lower[inner][row] * solution[inner];
    }
    solution[row] = sum / lower[row][row];
  }

  return solution;
}
