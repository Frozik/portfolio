import { useRootStore } from '../../../app/stores/StoreContext';
import { SudokuStore } from './SudokuStore';

export function useSudokuStore(): SudokuStore {
  return useRootStore().getOrCreateFeatureStore('sudoku', () => new SudokuStore());
}
