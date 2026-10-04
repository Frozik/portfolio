import { assert } from '@frozik/utils/assert/assert';
import { isSyncedValueDescriptor } from '@frozik/utils/value-descriptors/utils';

import { applyToolToFieldReducer, loadField } from './services';
import { findWrongCells, solvePuzzle } from './solution';
import type { IField } from './types';

const PUZZLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLUTION =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
/** Row 1 needs a 9 in its first cell, but column 1 already holds one below. */
const UNSOLVABLE = `012345678900000000${'0'.repeat(63)}`;

function field(puzzle: string): IField {
  const loaded = loadField(puzzle);
  assert(isSyncedValueDescriptor(loaded), 'fixture must load');
  return loaded.value;
}

function write(target: IField, row: number, column: number, value: number): IField {
  return applyToolToFieldReducer(target, { mode: 'pen', value }, row, column);
}

describe('solvePuzzle', () => {
  it('finds the solution the givens lead to', () => {
    expect(solvePuzzle(field(PUZZLE))?.join('')).toBe(SOLUTION);
  });

  it('ignores the player’s digits, right or wrong', () => {
    expect(solvePuzzle(write(field(PUZZLE), 0, 2, 1))?.join('')).toBe(SOLUTION);
  });

  it('reports givens that admit no solution', () => {
    expect(solvePuzzle(field(UNSOLVABLE))).toBeUndefined();
  });
});

describe('findWrongCells', () => {
  const solution = Array.from(SOLUTION, Number);

  it('flags a wrong digit even when it clashes with nothing', () => {
    const board = write(write(field(PUZZLE), 0, 2, 1), 0, 3, 6);

    expect(findWrongCells(board, solution)).toEqual([{ row: 0, column: 2, value: 1 }]);
  });

  it('accepts a board holding only givens and right digits', () => {
    expect(findWrongCells(write(field(PUZZLE), 0, 2, 4), solution)).toEqual([]);
  });
});
