import { assert } from '@frozik/utils/assert/assert';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { compact, isEmpty, isNil, range } from 'lodash-es';

import type { IField, IFieldCell, ITool } from './types';
import { ECellStatus, EFieldType } from './types';

const MIN_FIELD_SIZE = 3;
/** Characters a puzzle string may use for an empty cell besides `0`. */
const EMPTY_CELL_MARKERS: ReadonlySet<string> = new Set(['.', '-', '*']);

/**
 * A field char encodes a value in [0, size²], so the radix must be size² + 1
 * (10 for 9×9, 17 for 16×16) — a fixed radix of 10 makes 16×16's a–g parse to NaN.
 */
function getFieldRadix(size: number): number {
  return size ** 2 + 1;
}

/** `undefined` for a character outside the field alphabet. */
function parseCellValue(character: string, radix: number): number | undefined {
  if (EMPTY_CELL_MARKERS.has(character)) {
    return 0;
  }
  const value = Number.parseInt(character, radix);
  return Number.isNaN(value) ? undefined : value;
}

function createCell(value: number): IFieldCell {
  return value === 0
    ? { type: EFieldType.Guess, value: undefined, notes: [], status: ECellStatus.Unknown }
    : { type: EFieldType.Fixed, value, notes: [], status: ECellStatus.Unknown };
}

export function loadField(fieldData: string): ValueDescriptor<IField> {
  const size = Math.round(fieldData.length ** 0.25);

  if (size < MIN_FIELD_SIZE) {
    return createUnsyncedValueDescriptor(
      Fail(EValueDescriptorErrorCode.OUT_OF_RANGE, {
        message: 'Field size is not supported',
        description: `Field size is empty or less then 9x9, current size: ${size}x${size}`,
      })
    );
  }
  if (size ** 4 !== fieldData.length) {
    return createUnsyncedValueDescriptor(
      Fail(EValueDescriptorErrorCode.OUT_OF_RANGE, {
        message: 'Field size is invalid',
        description: `Field cell count must be a perfect square, current cells count: ${fieldData.length}`,
      })
    );
  }

  const radix = getFieldRadix(size);
  const characters = Array.from(fieldData);
  const values = characters.map(character => parseCellValue(character, radix));
  const unparseableIndex = values.findIndex(isNil);
  if (unparseableIndex >= 0) {
    return createUnsyncedValueDescriptor(
      Fail(EValueDescriptorErrorCode.OUT_OF_RANGE, {
        message: 'Field contains an unparseable character',
        description: `Character "${characters[unparseableIndex]}" at position ${unparseableIndex}`,
      })
    );
  }

  const cells = values.filter((value): value is number => !isNil(value)).map(createCell);
  const validatedField = validateField({ size, cells });
  // A given that contradicts another given cannot be fixed; let the player correct it.
  const demotedCells = validatedField.cells.map(cell =>
    cell.status === ECellStatus.Wrong && cell.type === EFieldType.Fixed
      ? { ...cell, type: EFieldType.Guess }
      : cell
  );
  return createSyncedValueDescriptor({ ...validatedField, cells: demotedCells });
}

export function getPairs(size: number): readonly (readonly [number, number])[] {
  return range(size).flatMap(row => range(size).map(column => [row, column] as const));
}

function getIndex(row: number, column: number, size: number): number {
  return row * size ** 2 + column;
}

/** The one place the row-major layout is trusted; every read goes through it. */
export function cellAt(field: IField, row: number, column: number): IFieldCell {
  const cell = field.cells[getIndex(row, column, field.size)];
  assert(!isNil(cell), `cell (${row}, ${column}) is outside a ${field.size ** 2}² field`);
  return cell;
}

interface IBoundCell {
  readonly row: number;
  readonly column: number;
  readonly cell: IFieldCell;
}

/** Every cell sharing a row, column or group with `(row, column)`, itself included. */
function getBoundCells(field: IField, row: number, column: number): readonly IBoundCell[] {
  const groupRow = Math.floor(row / field.size) * field.size;
  const groupColumn = Math.floor(column / field.size) * field.size;
  const byIndex = new Map<number, IBoundCell>();
  const add = (boundRow: number, boundColumn: number): void => {
    byIndex.set(getIndex(boundRow, boundColumn, field.size), {
      row: boundRow,
      column: boundColumn,
      cell: cellAt(field, boundRow, boundColumn),
    });
  };
  for (const index of range(field.size ** 2)) {
    add(row, index);
    add(index, column);
    add(groupRow + Math.floor(index / field.size), groupColumn + (index % field.size));
  }
  return Array.from(byIndex.values());
}

function withoutNote(cell: IFieldCell, note: number): IFieldCell {
  return { ...cell, notes: cell.notes.filter(candidate => candidate !== note) };
}

function applyPen(field: IField, row: number, column: number, value: number): IField {
  const cell = cellAt(field, row, column);
  if (cell.value === value) {
    return replaceCell(field, row, column, { ...cell, value: undefined });
  }
  const cells = [...field.cells];
  for (const bound of getBoundCells(field, row, column)) {
    cells[getIndex(bound.row, bound.column, field.size)] = withoutNote(bound.cell, value);
  }
  cells[getIndex(row, column, field.size)] = { ...withoutNote(cell, value), value };
  return { ...field, cells };
}

function applyNote(field: IField, row: number, column: number, value: number): IField {
  const cell = cellAt(field, row, column);
  const notes = cell.notes.includes(value)
    ? cell.notes.filter(note => note !== value)
    : [...cell.notes, value];
  return replaceCell(field, row, column, { ...cell, value: undefined, notes });
}

function replaceCell(field: IField, row: number, column: number, cell: IFieldCell): IField {
  const cells = [...field.cells];
  cells[getIndex(row, column, field.size)] = cell;
  return { ...field, cells };
}

/** Applies the tool at `(row, column)`; the same field comes back when nothing changes. */
export function applyToolToFieldReducer(
  field: IField,
  tool: ITool,
  row: number,
  column: number
): IField {
  if (isNil(tool.value) || cellAt(field, row, column).type === EFieldType.Fixed) {
    return field;
  }
  const next =
    tool.mode === 'pen'
      ? applyPen(field, row, column, tool.value)
      : applyNote(field, row, column, tool.value);
  return validateField(next);
}

function validateField(field: IField): IField {
  const cells = [...field.cells];
  for (const [row, column] of getPairs(field.size ** 2)) {
    const cell = cellAt(field, row, column);
    const isWrong =
      !isNil(cell.value) &&
      getBoundCells(field, row, column).some(
        bound => (bound.row !== row || bound.column !== column) && bound.cell.value === cell.value
      );
    const status = isWrong ? ECellStatus.Wrong : ECellStatus.Unknown;
    if (cell.status !== status) {
      cells[getIndex(row, column, field.size)] = { ...cell, status };
    }
  }
  return { ...field, cells };
}

/** How many groups already contain each number. */
export function getUsedNumbers(field: IField): ReadonlyMap<number, number> {
  const result = new Map<number, number>();
  for (const [groupRow, groupColumn] of getPairs(field.size)) {
    const valuesInGroup = new Set<number>();
    for (const [cellRow, cellColumn] of getPairs(field.size)) {
      const { value } = cellAt(
        field,
        groupRow * field.size + cellRow,
        groupColumn * field.size + cellColumn
      );
      if (!isNil(value)) {
        valuesInGroup.add(value);
      }
    }
    valuesInGroup.forEach(value => result.set(value, (result.get(value) ?? 0) + 1));
  }
  return result;
}

/** Fills every cell's notes with the candidates its row, column and group still allow. */
export function addFieldMarks(field: IField): IField {
  const allValues = range(1, field.size ** 2 + 1);
  const cells = [...field.cells];
  for (const [row, column] of getPairs(field.size ** 2)) {
    const usedNumbers = new Set(
      compact(
        getBoundCells(field, row, column)
          .filter(bound => bound.row !== row || bound.column !== column)
          .map(bound => bound.cell.value)
      )
    );
    cells[getIndex(row, column, field.size)] = {
      ...cellAt(field, row, column),
      notes: allValues.filter(value => !usedNumbers.has(value)),
    };
  }
  return { ...field, cells };
}

export function puzzleSolved(field: IField): boolean {
  return field.cells.every(cell => cell.status !== ECellStatus.Wrong && !isNil(cell.value));
}

export function cleanPuzzle(field: IField): IField {
  return {
    ...field,
    cells: field.cells.map(cell =>
      cell.type === EFieldType.Fixed
        ? { ...cell, status: ECellStatus.Unknown }
        : { ...cell, notes: [], value: undefined, status: ECellStatus.Unknown }
    ),
  };
}

export function hasMarks(field: IField): boolean {
  return field.cells.some(cell => cell.type !== EFieldType.Fixed && !isEmpty(cell.notes));
}

export function removeFieldMarks(field: IField): IField {
  return {
    ...field,
    cells: field.cells.map(cell =>
      cell.type === EFieldType.Fixed || isEmpty(cell.notes) ? cell : { ...cell, notes: [] }
    ),
  };
}
