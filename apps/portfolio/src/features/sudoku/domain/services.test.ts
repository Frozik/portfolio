import {
  isFailValueDescriptor,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import {
  addFieldMarks,
  applyToolToFieldReducer,
  getUsedNumbers,
  loadField,
  puzzleSolved,
} from './services';
import type { IField, TTool } from './types';
import { EFieldType, EToolType } from './types';

// A valid 9x9 sudoku puzzle string (81 chars, size=3)
// '0' represents empty cells
const VALID_PUZZLE =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

// A fully solved 9x9 puzzle
const SOLVED_PUZZLE =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

/** Any in-place write to the field, its cells or their notes throws in strict mode. */
function freezeField(field: IField): IField {
  field.cells.forEach(cell => {
    Object.freeze(cell.notes);
    Object.freeze(cell);
  });
  Object.freeze(field.cells);

  return Object.freeze(field);
}

describe('loadField', () => {
  it('parses a valid 9x9 puzzle string and returns synced VD', () => {
    const result = loadField(VALID_PUZZLE);

    expect(isSyncedValueDescriptor(result)).toBe(true);

    if (!isSyncedValueDescriptor(result)) {
      return;
    }

    const field = result.value;
    expect(field.size).toBe(3);
    expect(field.cells).toHaveLength(81);

    // First cell is '5' - should be Fixed
    expect(field.cells[0].type).toBe(EFieldType.Fixed);
    expect(field.cells[0].value).toBe(5);

    // Third cell is '.' - should be Guess with undefined value
    expect(field.cells[2].type).toBe(EFieldType.Guess);
    expect(field.cells[2].value).toBeUndefined();
  });

  it('returns fail VD for empty string', () => {
    const result = loadField('');
    expect(isFailValueDescriptor(result)).toBe(true);
  });

  it('returns fail VD for string with invalid length', () => {
    const result = loadField('12345');
    expect(isFailValueDescriptor(result)).toBe(true);
  });

  it('parses a 16x16 puzzle whose high values are encoded as letters (size=4 boundary)', () => {
    // 16x16 board: 256 cells, values 0..16 encoded in radix 17 (0-9 + a-g).
    // 'g' is the highest value (16) and is exactly the boundary that a fixed
    // radix of 10 would fail to parse, producing a Fixed cell with NaN.
    const SIZE_4_CELL_COUNT = 4 ** 4;
    const boardChars = new Array<string>(SIZE_4_CELL_COUNT).fill('0');
    // First cell holds the maximum value (16 => 'g'), the rest stay empty.
    boardChars[0] = 'g';
    const result = loadField(boardChars.join(''));

    expect(isSyncedValueDescriptor(result)).toBe(true);

    if (!isSyncedValueDescriptor(result)) {
      return;
    }

    const field = result.value;
    expect(field.size).toBe(4);
    expect(field.cells).toHaveLength(SIZE_4_CELL_COUNT);

    const MAX_VALUE = 16;
    expect(field.cells[0].type).toBe(EFieldType.Fixed);
    expect(field.cells[0].value).toBe(MAX_VALUE);
    expect(field.cells[1].type).toBe(EFieldType.Guess);
    expect(field.cells[1].value).toBeUndefined();
  });

  it('returns fail VD when a character cannot be parsed (never produces a Fixed NaN cell)', () => {
    // 'z' is not a valid digit in radix 17 and must not become a Fixed NaN cell.
    const SIZE_4_CELL_COUNT = 4 ** 4;
    const boardChars = new Array<string>(SIZE_4_CELL_COUNT).fill('0');
    boardChars[0] = 'z';
    const result = loadField(boardChars.join(''));

    expect(isFailValueDescriptor(result)).toBe(true);
  });
});

describe('applyToolToFieldReducer', () => {
  function getLoadedField(puzzle: string): IField {
    const result = loadField(puzzle);
    if (!isSyncedValueDescriptor(result)) {
      throw new Error('Failed to load field');
    }
    return result.value;
  }

  it('pen mode writes value to a guess cell', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const tool: TTool = { type: EToolType.Pen, value: 4 };

    // Cell at row=0, col=2 should be a guess cell (the '.' in position 2)
    const result = applyToolToFieldReducer(field, tool, 0, 2);

    const CELL_INDEX = 2;
    expect(result.cells[CELL_INDEX].value).toBe(4);
  });

  it('pen mode does not modify fixed cells', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const tool: TTool = { type: EToolType.Pen, value: 9 };

    // Cell at row=0, col=0 is '5' (fixed)
    const result = applyToolToFieldReducer(field, tool, 0, 0);

    expect(result.cells[0].value).toBe(5);
    expect(result).toBe(field);
  });

  it('pen mode clears value when same value applied', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const tool: TTool = { type: EToolType.Pen, value: 4 };

    const afterWrite = applyToolToFieldReducer(field, tool, 0, 2);
    const afterClear = applyToolToFieldReducer(afterWrite, tool, 0, 2);

    const CELL_INDEX = 2;
    expect(afterClear.cells[CELL_INDEX].value).toBeUndefined();
  });

  it('notes mode toggles candidate on', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const tool: TTool = { type: EToolType.Notes, value: 4 };

    const result = applyToolToFieldReducer(field, tool, 0, 2);

    const CELL_INDEX = 2;
    expect(result.cells[CELL_INDEX].notes).toContain(4);
    expect(result.cells[CELL_INDEX].value).toBeUndefined();
  });

  it('notes mode toggles candidate off', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const tool: TTool = { type: EToolType.Notes, value: 4 };

    const afterAdd = applyToolToFieldReducer(field, tool, 0, 2);
    const afterRemove = applyToolToFieldReducer(afterAdd, tool, 0, 2);

    const CELL_INDEX = 2;
    expect(afterRemove.cells[CELL_INDEX].notes).not.toContain(4);
  });

  it('none tool returns field unchanged', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const tool: TTool = { type: EToolType.None, value: undefined };

    const result = applyToolToFieldReducer(field, tool, 0, 2);
    expect(result).toBe(field);
  });

  it('leaves the input field untouched, including nested notes', () => {
    // `addFieldMarks` fills every cell with notes so both note paths are exercised:
    // the pen tool strips the written value from the bound cells' notes and the
    // notes tool toggles a candidate on the target cell.
    const field = freezeField(addFieldMarks(getLoadedField(VALID_PUZZLE)));
    const snapshot = structuredClone(field);

    applyToolToFieldReducer(field, { type: EToolType.Pen, value: 4 }, 0, 2);
    applyToolToFieldReducer(field, { type: EToolType.Notes, value: 7 }, 0, 2);

    expect(field).toEqual(snapshot);
  });

  it('reuses cells that the tool does not affect', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const tool: TTool = { type: EToolType.Pen, value: 4 };

    const result = applyToolToFieldReducer(field, tool, 0, 2);

    // Last cell of the board — outside the row, column and group of (0, 2).
    const UNAFFECTED_CELL_INDEX = 80;
    expect(result.cells[UNAFFECTED_CELL_INDEX]).toBe(field.cells[UNAFFECTED_CELL_INDEX]);
  });
});

describe('puzzleSolved', () => {
  function getLoadedField(puzzle: string): IField {
    const result = loadField(puzzle);
    if (!isSyncedValueDescriptor(result)) {
      throw new Error('Failed to load field');
    }
    return result.value;
  }

  it('returns true for a fully completed valid puzzle', () => {
    const field = getLoadedField(SOLVED_PUZZLE);
    expect(puzzleSolved(field)).toBe(true);
  });

  it('returns false for an incomplete puzzle', () => {
    const field = getLoadedField(VALID_PUZZLE);
    expect(puzzleSolved(field)).toBe(false);
  });
});

describe('getUsedNumbers', () => {
  function getLoadedField(puzzle: string): IField {
    const result = loadField(puzzle);
    if (!isSyncedValueDescriptor(result)) {
      throw new Error('Failed to load field');
    }
    return result.value;
  }

  it('counts numbers per group for a solved puzzle', () => {
    const field = getLoadedField(SOLVED_PUZZLE);
    const usedNumbers = getUsedNumbers(field);

    // In a solved 9x9 puzzle, each number 1-9 appears once in each of the 9 groups
    const GROUPS_COUNT = 9;
    for (let num = 1; num <= GROUPS_COUNT; num++) {
      expect(usedNumbers.get(num)).toBe(GROUPS_COUNT);
    }
  });

  it('returns partial counts for incomplete puzzle', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const usedNumbers = getUsedNumbers(field);

    // Should have some counts but not all 9 for every number
    let totalCount = 0;
    usedNumbers.forEach(count => {
      totalCount += count;
    });

    expect(totalCount).toBeGreaterThan(0);
    expect(totalCount).toBeLessThan(81);
  });
});

describe('addFieldMarks', () => {
  function getLoadedField(puzzle: string): IField {
    const result = loadField(puzzle);
    if (!isSyncedValueDescriptor(result)) {
      throw new Error('Failed to load field');
    }
    return result.value;
  }

  it('generates candidates for empty cells', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const marked = addFieldMarks(field);

    // Every cell should have some notes (candidates)
    for (let i = 0; i < marked.cells.length; i++) {
      const cell = marked.cells[i];
      expect(cell.notes.length).toBeGreaterThan(0);
    }
  });

  it('candidates do not include numbers already used in row/column/group', () => {
    const field = getLoadedField(VALID_PUZZLE);
    const marked = addFieldMarks(field);

    // Cell at (0, 2) is empty - row 0 has 5,3,7 as fixed values
    // So candidates should not include 5, 3, or 7
    const CELL_INDEX = 2;
    const cell = marked.cells[CELL_INDEX];
    expect(cell.notes).not.toContain(5);
    expect(cell.notes).not.toContain(3);
    expect(cell.notes).not.toContain(7);
  });
});
