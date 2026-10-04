import { isSyncedValueDescriptor } from '@frozik/utils/value-descriptors/utils';
import { isEmpty, isNil, range, sortBy } from 'lodash-es';

import { cellAt, getPairs, puzzleSolved } from '../domain/services';
import type { IField } from '../domain/types';
import { ECellStatus, EFieldType } from '../domain/types';
import type { SudokuStore } from './SudokuStore';

const EMPTY_CELL = '.';

export interface ICellPosition {
  readonly row: number;
  readonly column: number;
}

interface INotedCell extends ICellPosition {
  readonly candidates: readonly number[];
}

export type SudokuBoardDescription =
  | { readonly state: 'choosing-difficulty' }
  | {
      readonly state: 'solving' | 'solved';
      readonly rows: readonly string[];
      readonly givens: readonly string[];
      readonly conflicts: readonly ICellPosition[];
      readonly notes: readonly INotedCell[];
      readonly canUndo: boolean;
    };

function boardRows(field: IField, showCell: (row: number, column: number) => boolean): string[] {
  const side = field.size ** 2;
  return range(side).map(row =>
    range(side)
      .map(column => {
        const { value } = cellAt(field, row, column);
        return isNil(value) || !showCell(row, column) ? EMPTY_CELL : String(value);
      })
      .join('')
  );
}

/** What an agent reads instead of the DOM; positions are 1-based, as a person counts them. */
export function describeBoard(store: SudokuStore): SudokuBoardDescription {
  if (!isSyncedValueDescriptor(store.field)) {
    return { state: 'choosing-difficulty' };
  }
  const field = store.field.value;
  const side = field.size ** 2;
  const positions = getPairs(side).map(([row, column]) => ({ row, column }));
  const toAgentPosition = ({ row, column }: ICellPosition): ICellPosition => ({
    row: row + 1,
    column: column + 1,
  });
  return {
    state: puzzleSolved(field) ? 'solved' : 'solving',
    rows: boardRows(field, () => true),
    givens: boardRows(field, (row, column) => cellAt(field, row, column).type === EFieldType.Fixed),
    conflicts: positions
      .filter(({ row, column }) => cellAt(field, row, column).status === ECellStatus.Wrong)
      .map(toAgentPosition),
    notes: positions
      .filter(({ row, column }) => {
        const cell = cellAt(field, row, column);
        return isNil(cell.value) && !isEmpty(cell.notes);
      })
      .map(position => ({
        ...toAgentPosition(position),
        candidates: sortBy(cellAt(field, position.row, position.column).notes),
      })),
    canUndo: store.hasHistory,
  };
}
