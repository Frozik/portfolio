import { isNil, range } from 'lodash-es';

import { cellAt, getPairs } from './services';
import type { IField } from './types';
import { EFieldType } from './types';

const EMPTY = 0;

export interface IWrongCell {
  readonly row: number;
  readonly column: number;
  readonly value: number;
}

function peersOf(index: number, size: number): readonly number[] {
  const side = size ** 2;
  const row = Math.floor(index / side);
  const column = index % side;
  const groupRow = Math.floor(row / size) * size;
  const groupColumn = Math.floor(column / size) * size;
  const peers = new Set<number>();
  for (const offset of range(side)) {
    peers.add(row * side + offset);
    peers.add(offset * side + column);
    peers.add((groupRow + Math.floor(offset / size)) * side + groupColumn + (offset % size));
  }
  peers.delete(index);
  return Array.from(peers);
}

/**
 * The solution the givens lead to, row-major; player digits are ignored. Depth-first
 * search that always branches on the cell with the fewest candidates, which settles a
 * 9×9 puzzle in well under a millisecond. `undefined` when the givens admit none.
 */
export function solvePuzzle(field: IField): readonly number[] | undefined {
  const values = field.cells.map(cell =>
    cell.type === EFieldType.Fixed && !isNil(cell.value) ? cell.value : EMPTY
  );
  const digits = range(1, field.size ** 2 + 1);
  const peers = values.map((_, index) => peersOf(index, field.size));
  const candidatesAt = (index: number): readonly number[] => {
    const used = new Set(peers[index]?.map(peer => values[peer]));
    return digits.filter(digit => !used.has(digit));
  };

  const search = (): boolean => {
    let bestIndex = -1;
    let bestCandidates: readonly number[] = [];
    for (const [index, value] of values.entries()) {
      if (value !== EMPTY) {
        continue;
      }
      const candidates = candidatesAt(index);
      if (bestIndex < 0 || candidates.length < bestCandidates.length) {
        bestIndex = index;
        bestCandidates = candidates;
      }
    }
    if (bestIndex < 0) {
      return true;
    }
    for (const candidate of bestCandidates) {
      values[bestIndex] = candidate;
      if (search()) {
        return true;
      }
    }
    values[bestIndex] = EMPTY;
    return false;
  };

  return search() ? values : undefined;
}

/** Player digits that differ from the solution, clashing with a peer or not. */
export function findWrongCells(field: IField, solution: readonly number[]): readonly IWrongCell[] {
  const side = field.size ** 2;
  return getPairs(side).flatMap(([row, column]) => {
    const cell = cellAt(field, row, column);
    const expected = solution[row * side + column];
    return cell.type === EFieldType.Guess && !isNil(cell.value) && cell.value !== expected
      ? [{ row, column, value: cell.value }]
      : [];
  });
}
