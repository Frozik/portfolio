import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil, range } from 'lodash-es';

import { canPlaceValue, cellAt, getPairs } from './services';
import type { IField } from './types';

export type HintUnit = 'box' | 'row' | 'column';

/** The next digit plain logic forces, and the rule that forces it. */
export type Hint =
  | {
      readonly technique: 'naked-single';
      readonly row: number;
      readonly column: number;
      readonly value: number;
    }
  | {
      readonly technique: 'hidden-single';
      readonly unit: HintUnit;
      readonly row: number;
      readonly column: number;
      readonly value: number;
    };

type Position = readonly [row: number, column: number];

const UNITS: readonly HintUnit[] = ['box', 'row', 'column'];

function unitCells(field: IField, unit: HintUnit, index: number): readonly Position[] {
  const { size } = field;
  return range(size ** 2).map((offset): Position => {
    switch (unit) {
      case 'row':
        return [index, offset];
      case 'column':
        return [offset, index];
      case 'box':
        return [
          Math.floor(index / size) * size + Math.floor(offset / size),
          (index % size) * size + (offset % size),
        ];
      default:
        return assertNever(unit);
    }
  });
}

function candidatesOf(field: IField, [row, column]: Position): readonly number[] {
  return range(1, field.size ** 2 + 1).filter(value => canPlaceValue(field, row, column, value));
}

function findNakedSingle(field: IField): Hint | undefined {
  for (const [row, column] of getPairs(field.size ** 2)) {
    const candidates = candidatesOf(field, [row, column]);
    const [value] = candidates;
    if (candidates.length === 1 && !isNil(value)) {
      return { technique: 'naked-single', row, column, value };
    }
  }
  return undefined;
}

function findHiddenSingle(field: IField): Hint | undefined {
  const side = field.size ** 2;
  for (const unit of UNITS) {
    for (const index of range(side)) {
      const cells = unitCells(field, unit, index);
      for (const value of range(1, side + 1)) {
        if (cells.some(([row, column]) => cellAt(field, row, column).value === value)) {
          continue;
        }
        const places = cells.filter(([row, column]) => canPlaceValue(field, row, column, value));
        const [place] = places;
        if (places.length === 1 && !isNil(place)) {
          return { technique: 'hidden-single', unit, row: place[0], column: place[1], value };
        }
      }
    }
  }
  return undefined;
}

/**
 * Reads only the digits on the board, never the player's notes, so a wrong player
 * digit can mislead it. `undefined` when no single is left — the puzzle then needs a
 * stronger technique.
 */
export function findHint(field: IField): Hint | undefined {
  return findNakedSingle(field) ?? findHiddenSingle(field);
}
