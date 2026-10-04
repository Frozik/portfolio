import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { Hint, HintUnit } from '../domain/hints';
import { findHint } from '../domain/hints';
import { cellAt, getPairs } from '../domain/services';
import { findWrongCells } from '../domain/solution';
import type { IField } from '../domain/types';

function unitName(unit: HintUnit, row: number, column: number, size: number): string {
  switch (unit) {
    case 'row':
      return `row ${row}`;
    case 'column':
      return `column ${column}`;
    case 'box': {
      const top = Math.floor((row - 1) / size) * size + 1;
      const left = Math.floor((column - 1) / size) * size + 1;
      return `the box of rows ${top}–${top + size - 1}, columns ${left}–${left + size - 1}`;
    }
    default:
      return assertNever(unit);
  }
}

function reasonFor(hint: Hint, row: number, column: number, size: number): string {
  switch (hint.technique) {
    case 'naked-single':
      return `Every other digit already appears in the row, column or box of row ${row}, column ${column}, so only ${hint.value} fits there.`;
    case 'hidden-single':
      return `${hint.value} can go nowhere else in ${unitName(hint.unit, row, column, size)}.`;
    default:
      return assertNever(hint);
  }
}

/** The next forced digit in the 1-based terms an agent and a person use. */
export function describeHint(field: IField) {
  const hint = findHint(field);
  if (isNil(hint)) {
    return {
      hint: null,
      reason:
        'No single is left: every empty cell has several candidates and every digit has ' +
        'several places. Pencil candidates and look for pairs, or call sudoku_check.',
    };
  }
  const row = hint.row + 1;
  const column = hint.column + 1;
  return {
    hint: { row, column, digit: hint.value, technique: hint.technique },
    reason: reasonFor(hint, row, column, field.size),
  };
}

/** Which player digits disagree with the solution, and how much is left to fill. */
export function describeCheck(field: IField, solution: readonly number[]) {
  const wrong = findWrongCells(field, solution).map(({ row, column, value }) => ({
    row: row + 1,
    column: column + 1,
    digit: value,
  }));
  const emptyCells = getPairs(field.size ** 2).filter(([row, column]) =>
    isNil(cellAt(field, row, column).value)
  ).length;
  return { wrong, emptyCells, onTrack: wrong.length === 0 };
}
