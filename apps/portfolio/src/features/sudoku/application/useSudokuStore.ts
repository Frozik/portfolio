import { useRootStore } from '../../../app/stores';
import { SudokuStore } from './SudokuStore';

export function useSudokuStore(): SudokuStore {
  return useRootStore().getOrCreateFeatureStore('sudoku', () => new SudokuStore());
}
