import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';
import { convertErrorToFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isEmpty, isNil } from 'lodash-es';

import type { IField, IFieldCell, TTool } from './types';
import { ECellStatus, EFieldType, EToolType } from './types';

export function loadField(fieldData: string): ValueDescriptor<IField> {
  const size = Math.round(fieldData.length ** 0.25);

  if (size < 3) {
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

  try {
    const cells = Array.from(fieldData).map(cellValue => {
      const value = Number.parseInt(cellValue.replace(/[.\-*]/g, '0'), Math.max(10, size));

      return value === 0
        ? {
            type: EFieldType.Guess,
            value: undefined,
            notes: [],
            status: ECellStatus.Unknown,
          }
        : {
            type: EFieldType.Fixed,
            value,
            notes: [],
            status: ECellStatus.Unknown,
          };
    });

    const validatedField = validateField({ size, cells });

    for (let row = 0; row < validatedField.size ** 2; row++) {
      for (let column = 0; column < validatedField.size ** 2; column++) {
        const index = getIndex(row, column, validatedField.size);
        const cell = validatedField.cells[index];

        if (cell.status === ECellStatus.Wrong && cell.type === EFieldType.Fixed) {
          cell.type = EFieldType.Guess;
        }
      }
    }

    return createSyncedValueDescriptor(validatedField);
  } catch (error) {
    return createUnsyncedValueDescriptor(convertErrorToFail(error as Error));
  }
}

export function getPairs(size: number): [number, number][] {
  const pairs: [number, number][] = [];

  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      pairs.push([row, column]);
    }
  }

  return pairs;
}

export function applyToolToFieldReducer(
  field: IField,
  tool: TTool,
  row: number,
  column: number
): IField {
  if (tool.type === EToolType.None) {
    return field;
  }

  const index = getIndex(row, column, field.size);

  const existingCell = field.cells[index];

  if (existingCell.type === EFieldType.Fixed) {
    return field;
  }

  const cells = [...field.cells];
  const cell = { ...existingCell, notes: [...existingCell.notes] };

  if (tool.type === EToolType.Pen) {
    if (cell.value !== tool.value) {
      cell.value = tool.value;
      cell.notes = cell.notes = cell.notes.filter(note => note !== tool.value);

      getBoundCells(field, row, column).forEach(({ row, column, cell }) => {
        cells[getIndex(row, column, field.size)] = {
          ...cell,
          notes: cell.notes.filter(note => note !== tool.value),
        };
      });
    } else {
      cell.value = undefined;
    }
  } else if (tool.type === EToolType.Notes) {
    cell.value = undefined;

    if (cell.notes.includes(tool.value)) {
      cell.notes = cell.notes.filter(note => note !== tool.value);
    } else {
      cell.notes.push(tool.value);
    }
  }

  cells[index] = cell;

  return validateField({ ...field, cells });
}

function getIndex(row: number, column: number, size: number): number {
  return row * size ** 2 + column;
}

enum EBoundType {
  Row = 'row',
  Column = 'column',
  Group = 'group',
}

function getBoundCells(
  field: IField,
  row: number,
  column: number,
  boundTypes: EBoundType[] = [EBoundType.Row, EBoundType.Column, EBoundType.Group]
): { cell: IFieldCell; row: number; column: number }[] {
  const map = new Map<number, { cell: IFieldCell; row: number; column: number }>();

  const groupRow = Math.floor(row / field.size) * field.size;
  const groupColumn = Math.floor(column / field.size) * field.size;

  for (let index = 0; index < field.size ** 2; index++) {
    if (boundTypes.includes(EBoundType.Row)) {
      const rowIndex = getIndex(row, index, field.size);

      map.set(rowIndex, { row, column: index, cell: field.cells[rowIndex] });
    }
    if (boundTypes.includes(EBoundType.Column)) {
      const columnIndex = getIndex(index, column, field.size);

      map.set(columnIndex, { row: index, column, cell: field.cells[columnIndex] });
    }
    if (boundTypes.includes(EBoundType.Group)) {
      const cellGroupRow = Math.floor(index / field.size);
      const cellGroupColumn = index % field.size;

      const groupIndex = getIndex(
        groupRow + cellGroupRow,
        groupColumn + cellGroupColumn,
        field.size
      );

      map.set(groupIndex, {
        row: groupRow + cellGroupRow,
        column: groupColumn + cellGroupColumn,
        cell: field.cells[groupIndex],
      });
    }
  }

  return Array.from(map.values());
}

function validateField(field: IField): IField {
  const cells = [...field.cells];

  for (let row = 0; row < field.size ** 2; row++) {
    for (let column = 0; column < field.size ** 2; column++) {
      const index = getIndex(row, column, field.size);

      const cell = field.cells[index];

      const isWrong =
        !isNil(cell.value) &&
        getBoundCells(field, row, column).some(
          ({ row: boundRow, column: boundColumn, cell: { value } }) =>
            (boundRow !== row || boundColumn !== column) && value === cell.value
        );

      cells[index] = {
        ...cell,
        status: isWrong ? ECellStatus.Wrong : ECellStatus.Unknown,
      };
    }
  }

  return { ...field, cells };
}

export function getUsedNumbers(field: IField): ReadonlyMap<number, number> {
  const result = new Map<number, number>();

  for (let groupRow = 0; groupRow < field.size; groupRow++) {
    for (let groupColumn = 0; groupColumn < field.size; groupColumn++) {
      const set = new Set<number>();

      for (let cellRow = 0; cellRow < field.size; cellRow++) {
        for (let cellColumn = 0; cellColumn < field.size; cellColumn++) {
          const index = getIndex(
            groupRow * field.size + cellRow,
            groupColumn * field.size + cellColumn,
            field.size
          );

          const cell = field.cells[index];

          if (!isNil(cell.value)) {
            set.add(cell.value);
          }
        }
      }

      set.forEach(value => result.set(value, (result.get(value) ?? 0) + 1));
    }
  }

  return result;
}

export function getIndexesArray(size: number): number[] {
  return new Array(size).fill(0).map((_, index) => index);
}

export function addFieldMarks(field: IField): IField {
  const cells = [...field.cells];

  for (let row = 0; row < field.size ** 2; row++) {
    for (let column = 0; column < field.size ** 2; column++) {
      const index = getIndex(row, column, field.size);

      const cell = field.cells[index];

      const usedNumbers = new Set(
        getBoundCells(field, row, column)
          .filter(
            ({ row: boundRow, column: boundColumn, cell: { value } }) =>
              (boundRow !== row || boundColumn !== column) && !isNil(value)
          )
          .map(({ cell: { value } }) => value as number)
      );

      cells[index] = {
        ...cell,
        notes: getIndexesArray(field.size ** 2)
          .map(value => value + 1)
          .filter(value => !usedNumbers.has(value)),
      };
    }
  }

  return { ...field, cells };
}

export function puzzleSolved(field: IField): boolean {
  for (let index = 0; index < field.size ** 4; index++) {
    const cell = field.cells[index];

    if (cell.status === ECellStatus.Wrong || isNil(cell.value)) {
      return false;
    }
  }

  return true;
}

export function cleanPuzzle(field: IField): IField {
  const cells = [...field.cells];

  for (let index = 0; index < field.size ** 4; index++) {
    const cell = field.cells[index];

    if (cell.type === EFieldType.Fixed) {
      cells[index] = {
        ...cell,
        status: ECellStatus.Unknown,
      };
    } else {
      cells[index] = {
        ...cell,
        notes: [],
        value: undefined,
        status: ECellStatus.Unknown,
      };
    }
  }

  return { ...field, cells };
}

export function hasMarks(field: IField): boolean {
  for (let index = 0; index < field.size ** 4; index++) {
    const cell = field.cells[index];

    if (cell.type === EFieldType.Fixed) {
      continue;
    }

    if (!isEmpty(cell.notes)) {
      return true;
    }
  }

  return false;
}

export function removeFieldMarks(field: IField): IField {
  const cells = [...field.cells];

  for (let index = 0; index < field.size ** 4; index++) {
    const cell = field.cells[index];

    if (cell.type === EFieldType.Fixed || isEmpty(cell.notes)) {
      continue;
    }

    cells[index] = { ...cell, notes: [] };
  }

  return { ...field, cells };
}
