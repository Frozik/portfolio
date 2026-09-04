import { getSudoku } from 'sudoku-gen';

import type { IPuzzleGenerator } from '../domain/ports/puzzle-generator';
import type { SudokuDifficulty } from '../domain/types';

const LIBRARY_EMPTY_CELL = /-/g;
const FIELD_EMPTY_CELL = '0';

/** `sudoku-gen` marks empty cells with `-`; the field format wants `0`. */
export const sudokuGenPuzzleGenerator: IPuzzleGenerator = {
  generate(difficulty: SudokuDifficulty): string {
    return getSudoku(difficulty).puzzle.replace(LIBRARY_EMPTY_CELL, FIELD_EMPTY_CELL);
  },
};
