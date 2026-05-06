import type { PuzzleDefinition } from '../types';
import { PUZZLE_1 } from './puzzle-1';
import { PUZZLE_2 } from './puzzle-2';

export const PUZZLES: readonly PuzzleDefinition[] = [PUZZLE_1, PUZZLE_2];

export function getPuzzleById(puzzleId: string | undefined): PuzzleDefinition | undefined {
  if (puzzleId === undefined) {
    return undefined;
  }

  return PUZZLES.find(puzzle => puzzle.id === puzzleId);
}
