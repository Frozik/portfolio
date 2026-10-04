import { isSyncedValueDescriptor } from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { when } from 'mobx';
import { z } from 'zod';

import type { IAgentTool, IAgentToolRefusal } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool, refuse } from '@frozik/utils/webmcp/agentTool';
import { cellAt } from '../domain/services';
import { solvePuzzle } from '../domain/solution';
import type { IField, SudokuDifficulty } from '../domain/types';
import { EFieldType } from '../domain/types';
import type { ICellPosition, SudokuBoardDescription } from './sudoku-board-description';
import { describeBoard } from './sudoku-board-description';
import { describeCheck, describeHint } from './sudoku-solving-description';
import type { SudokuStore } from './SudokuStore';

const BOARD_SIDE = 9;
const PUZZLE_LOAD_TIMEOUT_MS = 5_000;

const DIFFICULTIES = [
  'easy',
  'medium',
  'hard',
  'expert',
] as const satisfies readonly SudokuDifficulty[];

const coordinate = z.int().min(1).max(BOARD_SIDE);
const digit = z.int().min(1).max(BOARD_SIDE);
const cellInput = z.object({
  row: coordinate.describe('Row, 1 (top) to 9 (bottom).'),
  column: coordinate.describe('Column, 1 (left) to 9 (right).'),
});
const digitInput = cellInput.extend({ digit: digit.describe('Digit 1 to 9.') });

function editCell(
  store: SudokuStore,
  { row, column }: ICellPosition,
  edit: (field: IField) => void
): SudokuBoardDescription | IAgentToolRefusal {
  if (!isSyncedValueDescriptor(store.field)) {
    return refuse(NO_PUZZLE);
  }
  const field = store.field.value;
  if (cellAt(field, row - 1, column - 1).type === EFieldType.Fixed) {
    return refuse(`Row ${row}, column ${column} is a given and cannot be changed.`);
  }
  edit(field);
  return describeBoard(store);
}

const NO_PUZZLE = 'No puzzle is open. Call sudoku_new_puzzle first.';

const BOARD_FORMAT =
  'The board comes back as `rows` (nine strings, top to bottom, "." for an empty cell), ' +
  '`givens` (the same grid with only the fixed starting digits), `conflicts` (cells that ' +
  'clash with a peer in their row, column or 3×3 box), `notes` (pencilled candidates) ' +
  'and `state` ("choosing-difficulty", "solving" or "solved").';

export function createSudokuAgentTools(
  store: SudokuStore,
  openPuzzle: (puzzle: string) => void
): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: 'sudoku_get_board',
      title: 'Read the sudoku board',
      description: `Reads the sudoku the user sees. ${BOARD_FORMAT}`,
      input: z.object({}),
      readOnly: true,
      execute: () => describeBoard(store),
    }),
    defineAgentTool({
      name: 'sudoku_new_puzzle',
      title: 'Start a new sudoku',
      description: `Generates a new puzzle and opens it, replacing the current one and its progress. Returns the board. ${BOARD_FORMAT}`,
      input: z.object({ difficulty: z.enum(DIFFICULTIES) }),
      execute: async ({ difficulty }, signal) => {
        store.resetPuzzle();
        openPuzzle(store.createPuzzle(difficulty));
        await when(() => isSyncedValueDescriptor(store.field), {
          signal,
          timeout: PUZZLE_LOAD_TIMEOUT_MS,
        });
        return describeBoard(store);
      },
    }),
    defineAgentTool({
      name: 'sudoku_write_digit',
      title: 'Write a digit',
      description:
        'Writes a digit into an empty or player-filled cell, replacing what was there and ' +
        'clearing that digit from the notes of its row, column and box. Givens cannot be ' +
        'changed. A wrong digit is accepted and reported in `conflicts`. Returns the board.',
      input: digitInput,
      execute: ({ row, column, digit: value }) =>
        editCell(store, { row, column }, field => {
          if (cellAt(field, row - 1, column - 1).value !== value) {
            store.applyToolAt(row - 1, column - 1, { mode: 'pen', value });
          }
        }),
    }),
    defineAgentTool({
      name: 'sudoku_erase_digit',
      title: 'Erase a digit',
      description: 'Empties a player-filled cell. Givens cannot be erased. Returns the board.',
      input: cellInput,
      execute: ({ row, column }) =>
        editCell(store, { row, column }, field => {
          const { value } = cellAt(field, row - 1, column - 1);
          if (!isNil(value)) {
            store.applyToolAt(row - 1, column - 1, { mode: 'pen', value });
          }
        }),
    }),
    defineAgentTool({
      name: 'sudoku_toggle_note',
      title: 'Toggle a candidate note',
      description:
        'Adds the digit to the pencilled candidates of an empty cell, or removes it when it ' +
        'is already there. Writing a note into a filled cell empties that cell. Returns the board.',
      input: digitInput,
      execute: ({ row, column, digit: value }) =>
        editCell(store, { row, column }, () =>
          store.applyToolAt(row - 1, column - 1, { mode: 'notes', value })
        ),
    }),
    defineAgentTool({
      name: 'sudoku_fill_candidates',
      title: 'Pencil in every candidate',
      description:
        'Fills the notes of every empty cell with each digit its row, column and box still ' +
        'allow, replacing the notes that were there — the board button for the same thing. ' +
        'Undo restores the previous notes. Returns the board.',
      input: z.object({}),
      execute: () => {
        if (!isSyncedValueDescriptor(store.field)) {
          return refuse(NO_PUZZLE);
        }
        store.fillMarks();
        return describeBoard(store);
      },
    }),
    defineAgentTool({
      name: 'sudoku_hint',
      title: 'Suggest the next move',
      description:
        'Finds the next digit plain logic forces — a cell with one candidate left, or a ' +
        'digit with one place left in a row, column or box — and explains why. It reads the ' +
        'digits on the board, not the notes; a wrong player digit can mislead it, so run ' +
        'sudoku_check when a hint looks odd. Changes nothing; write the digit yourself.',
      input: z.object({}),
      readOnly: true,
      execute: () =>
        isSyncedValueDescriptor(store.field) ? describeHint(store.field.value) : refuse(NO_PUZZLE),
    }),
    defineAgentTool({
      name: 'sudoku_check',
      title: 'Check the player’s digits',
      description:
        'Compares every digit the player wrote with the solution and lists the wrong ones, ' +
        'including those that clash with nothing yet, plus how many cells are still empty. ' +
        'Changes nothing and never reveals the right digits.',
      input: z.object({}),
      readOnly: true,
      execute: () => {
        if (!isSyncedValueDescriptor(store.field)) {
          return refuse(NO_PUZZLE);
        }
        const solution = solvePuzzle(store.field.value);
        return isNil(solution)
          ? refuse('The givens of this puzzle admit no solution.')
          : describeCheck(store.field.value, solution);
      },
    }),
    defineAgentTool({
      name: 'sudoku_undo',
      title: 'Undo the last move',
      description: 'Reverts the last change to the board, whoever made it. Returns the board.',
      input: z.object({}),
      execute: () => {
        store.restorePreviousState();
        return describeBoard(store);
      },
    }),
  ];
}
