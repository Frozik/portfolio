import { solveSymmetricPositiveDefinite } from './linear-solve';

describe('solveSymmetricPositiveDefinite', () => {
  it('solves a positive-definite system', () => {
    const matrix = [
      [4, 2, 0],
      [2, 5, 1],
      [0, 1, 3],
    ];
    const expected = [1, -2, 3];
    const rightHandSide = matrix.map(row =>
      row.reduce((sum, value, index) => sum + value * expected[index], 0)
    );

    const solution = solveSymmetricPositiveDefinite(matrix, rightHandSide);

    solution.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 10));
  });

  it('rejects a matrix that is not positive definite', () => {
    expect(() => solveSymmetricPositiveDefinite([[-1]], [1])).toThrow();
  });
});
