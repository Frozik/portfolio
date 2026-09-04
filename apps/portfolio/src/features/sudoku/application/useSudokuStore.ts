import { useRootStore } from '../../../app/stores/StoreContext';
import { sudokuGenPuzzleGenerator } from '../infrastructure/sudoku-gen-puzzle-generator';
import { SudokuStore } from './SudokuStore';

export function useSudokuStore(): SudokuStore {
  return useRootStore().getOrCreateFeatureStore(
    'sudoku',
    () => new SudokuStore(sudokuGenPuzzleGenerator)
  );
}
