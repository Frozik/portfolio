import { assert } from '@frozik/utils/assert/assert';
import { isSyncedValueDescriptor } from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';

import { findHint } from './hints';
import { applyToolToFieldReducer, loadField, puzzleSolved } from './services';
import type { IField } from './types';

const PUZZLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLUTION =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const HARDER_PUZZLE =
  '096000800020000009400008010030650700000702004200003050000000200000300070100000006';
const SIDE = 9;
const MAX_STEPS = 81;

function field(puzzle: string): IField {
  const loaded = loadField(puzzle);
  assert(isSyncedValueDescriptor(loaded), 'fixture must load');
  return loaded.value;
}

describe('findHint', () => {
  it('names the last digit a cell can take as a naked single', () => {
    const oneGap = `0${SOLUTION.slice(1)}`;

    expect(findHint(field(oneGap))).toEqual({
      technique: 'naked-single',
      row: 0,
      column: 0,
      value: 5,
    });
  });

  it('finds a digit with a single place left in its box', () => {
    expect(findHint(field(HARDER_PUZZLE))).toEqual({
      technique: 'hidden-single',
      unit: 'box',
      row: 1,
      column: 2,
      value: 1,
    });
  });

  it('leads an easy puzzle to its solution, every hint agreeing with it', () => {
    let board = field(PUZZLE);
    for (let step = 0; step < MAX_STEPS && !puzzleSolved(board); step++) {
      const hint = findHint(board);
      assert(!isNil(hint), `no hint at step ${step}`);
      expect(hint.value).toBe(Number(SOLUTION[hint.row * SIDE + hint.column]));
      board = applyToolToFieldReducer(
        board,
        { mode: 'pen', value: hint.value },
        hint.row,
        hint.column
      );
    }

    expect(puzzleSolved(board)).toBe(true);
  });

  it('has nothing to suggest on a solved board', () => {
    expect(findHint(field(SOLUTION))).toBeUndefined();
  });
});
