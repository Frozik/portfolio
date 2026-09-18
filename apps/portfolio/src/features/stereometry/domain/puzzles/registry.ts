import type { PuzzleDefinition } from '../types';
import { PUZZLE_1 } from './puzzle-1';
import { PUZZLE_2 } from './puzzle-2';
import { PUZZLE_3 } from './puzzle-3';
import { PUZZLE_4 } from './puzzle-4';
import { PUZZLE_5 } from './puzzle-5';
import { PUZZLE_6 } from './puzzle-6';
import { PUZZLE_7 } from './puzzle-7';
import { PUZZLE_8 } from './puzzle-8';

export const PUZZLES: readonly PuzzleDefinition[] = [
  PUZZLE_1,
  PUZZLE_2,
  PUZZLE_3,
  PUZZLE_4,
  PUZZLE_5,
  PUZZLE_6,
  PUZZLE_7,
  PUZZLE_8,
];

export function getPuzzleById(puzzleId: string | undefined): PuzzleDefinition | undefined {
  if (puzzleId === undefined) {
    return undefined;
  }

  return PUZZLES.find(puzzle => puzzle.id === puzzleId);
}
