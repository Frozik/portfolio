import { assert } from '@frozik/utils/assert/assert';
import { EMPTY_VD, isSyncedValueDescriptor } from '@frozik/utils/value-descriptors/utils';

import { SudokuStore } from './SudokuStore';

const NO_GENERATOR = {
  generate(): string {
    return VALID_PUZZLE;
  },
};

// A valid 9x9 sudoku puzzle string (81 chars)
const VALID_PUZZLE =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

describe('SudokuStore', () => {
  let store: SudokuStore;

  beforeEach(() => {
    store = new SudokuStore(NO_GENERATOR);
  });

  describe('initial state', () => {
    it('starts with EMPTY_VD field', () => {
      expect(store.field).toEqual(EMPTY_VD);
    });

    it('starts with no history', () => {
      expect(store.hasHistory).toBe(false);
    });
  });

  describe('loadPuzzle', () => {
    it('sets field to synced VD for valid puzzle', () => {
      store.loadPuzzle(VALID_PUZZLE);

      expect(isSyncedValueDescriptor(store.field)).toBe(true);
    });

    it('clears history on load', () => {
      store.loadPuzzle(VALID_PUZZLE);
      store.setToolValue(4);
      store.applyTool(0, 2);

      expect(store.hasHistory).toBe(true);

      store.loadPuzzle(VALID_PUZZLE);
      expect(store.hasHistory).toBe(false);
    });
  });

  describe('applyTool', () => {
    it('modifies field when applying pen tool', () => {
      store.loadPuzzle(VALID_PUZZLE);
      store.setToolValue(4);

      const fieldBefore = store.field;
      store.applyTool(0, 2);

      expect(store.field).not.toEqual(fieldBefore);

      if (!isSyncedValueDescriptor(store.field)) {
        return;
      }
      expect(store.field.value.cells[2].value).toBe(4);
    });

    it('does nothing while no number is selected', () => {
      store.loadPuzzle(VALID_PUZZLE);

      const fieldBefore = store.field;
      store.applyTool(0, 2);

      expect(store.field).toBe(fieldBefore);
    });
  });

  describe('hasHistory', () => {
    it('reflects history state after tool application', () => {
      store.loadPuzzle(VALID_PUZZLE);
      expect(store.hasHistory).toBe(false);

      store.setToolValue(4);
      store.applyTool(0, 2);

      expect(store.hasHistory).toBe(true);
    });
  });

  describe('restorePreviousState', () => {
    it('pops history and restores previous field', () => {
      store.loadPuzzle(VALID_PUZZLE);
      const originalField = store.field;

      store.setToolValue(4);
      store.applyTool(0, 2);

      expect(store.hasHistory).toBe(true);

      store.restorePreviousState();

      expect(store.hasHistory).toBe(false);

      if (!isSyncedValueDescriptor(store.field) || !isSyncedValueDescriptor(originalField)) {
        return;
      }
      expect(store.field.value.cells[2].value).toBe(originalField.value.cells[2].value);
    });

    it('keeps every snapshot independent from the moves made after it', () => {
      store.loadPuzzle(VALID_PUZZLE);

      store.setToolValue(4);
      store.applyTool(0, 2);

      store.setToolMode('notes');
      store.setToolValue(7);
      store.applyTool(0, 3);

      store.restorePreviousState();
      store.restorePreviousState();

      assert(isSyncedValueDescriptor(store.field), 'field must be synced after undo');

      const PEN_CELL_INDEX = 2;
      const NOTES_CELL_INDEX = 3;

      expect(store.field.value.cells[PEN_CELL_INDEX].value).toBeUndefined();
      expect(store.field.value.cells[NOTES_CELL_INDEX].notes).toEqual([]);
    });

    it('does nothing when history is empty', () => {
      store.loadPuzzle(VALID_PUZZLE);
      const fieldBefore = store.field;

      store.restorePreviousState();

      expect(store.field).toBe(fieldBefore);
    });
  });
});
