import type { SudokuDifficulty } from '../types';

/** Produces a puzzle string in the field format: one character per cell, `0` for empty. */
export interface IPuzzleGenerator {
  generate(difficulty: SudokuDifficulty): string;
}
