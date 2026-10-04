import { assert } from '@frozik/utils/assert/assert';
import { isSyncedValueDescriptor } from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';

import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { createSudokuAgentTools } from './sudoku-agent-tools';
import { SudokuStore } from './SudokuStore';

const PUZZLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

function setup(): {
  readonly store: SudokuStore;
  readonly call: (name: string, input?: object) => Promise<unknown>;
} {
  const store = new SudokuStore({ generate: () => PUZZLE });
  const tools = createSudokuAgentTools(store, puzzle => store.loadPuzzle(puzzle));
  const call = (name: string, input: object = {}): Promise<unknown> => {
    const tool = tools.find((candidate: IAgentTool) => candidate.name === name);
    assert(!isNil(tool), `no ${name} tool`);
    return tool.run(input, new AbortController().signal);
  };
  return { store, call };
}

describe('sudoku agent tools', () => {
  it('tells the agent no puzzle is open while the difficulty picker shows', async () => {
    const { call } = setup();

    await expect(call('sudoku_get_board')).resolves.toEqual({ state: 'choosing-difficulty' });
  });

  it('opens a new puzzle and returns its board, givens included', async () => {
    const { call } = setup();

    const board = await call('sudoku_new_puzzle', { difficulty: 'easy' });

    expect(board).toMatchObject({
      state: 'solving',
      canUndo: false,
      conflicts: [],
      notes: [],
    });
    expect(board).toHaveProperty(['rows', 0], '53..7....');
    expect(board).toHaveProperty(['givens', 0], '53..7....');
  });

  it('writes a digit at a 1-based position without touching the player’s keypad selection', async () => {
    const { store, call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });

    const board = await call('sudoku_write_digit', { row: 1, column: 3, digit: 4 });

    expect(board).toHaveProperty(['rows', 0], '534.7....');
    expect(board).toHaveProperty(['givens', 0], '53..7....');
    expect(store.tool.value).toBeUndefined();
  });

  it('keeps the digit when the same one is written twice', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });

    await call('sudoku_write_digit', { row: 1, column: 3, digit: 4 });
    const board = await call('sudoku_write_digit', { row: 1, column: 3, digit: 4 });

    expect(board).toHaveProperty(['rows', 0], '534.7....');
  });

  it('reports a clashing digit as a conflict instead of refusing it', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });

    const board = await call('sudoku_write_digit', { row: 1, column: 3, digit: 5 });

    expect(board).toHaveProperty('conflicts', [
      { row: 1, column: 1 },
      { row: 1, column: 3 },
    ]);
  });

  it('refuses to change a given', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });

    await expect(call('sudoku_write_digit', { row: 1, column: 1, digit: 4 })).resolves.toEqual({
      error: expect.stringMatching(/given/),
    });
    await expect(call('sudoku_erase_digit', { row: 1, column: 1 })).resolves.toEqual({
      error: expect.stringMatching(/given/),
    });
  });

  it('erases a digit and undoes moves', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });
    await call('sudoku_write_digit', { row: 1, column: 3, digit: 4 });

    await expect(call('sudoku_erase_digit', { row: 1, column: 3 })).resolves.toHaveProperty(
      ['rows', 0],
      '53..7....'
    );
    await expect(call('sudoku_undo')).resolves.toHaveProperty(['rows', 0], '534.7....');
  });

  it('pencils candidates in sorted order and removes them on a second toggle', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });

    await call('sudoku_toggle_note', { row: 1, column: 3, digit: 4 });
    const board = await call('sudoku_toggle_note', { row: 1, column: 3, digit: 1 });
    expect(board).toHaveProperty('notes', [{ row: 1, column: 3, candidates: [1, 4] }]);

    await expect(
      call('sudoku_toggle_note', { row: 1, column: 3, digit: 4 })
    ).resolves.toHaveProperty('notes', [{ row: 1, column: 3, candidates: [1] }]);
  });

  it('pencils every legal candidate into the empty cells in one move', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });
    await call('sudoku_toggle_note', { row: 1, column: 3, digit: 9 });

    const board = await call('sudoku_fill_candidates');

    expect(board).toHaveProperty(['notes', 0], { row: 1, column: 3, candidates: [1, 2, 4] });
    expect(board).toHaveProperty('notes.length', 51);
    await expect(call('sudoku_undo')).resolves.toHaveProperty('notes', [
      { row: 1, column: 3, candidates: [9] },
    ]);
  });

  it('suggests the next forced digit with its reason, leaving the board as it was', async () => {
    const { store, call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });
    const before = store.field;

    const answer = await call('sudoku_hint');

    expect(answer).toEqual({
      hint: { row: 5, column: 5, digit: 5, technique: 'naked-single' },
      reason: expect.stringContaining('only 5 fits'),
    });
    expect(store.field).toBe(before);
  });

  it('lists the wrong digits without revealing the right ones', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });
    await call('sudoku_write_digit', { row: 1, column: 3, digit: 1 });
    await call('sudoku_write_digit', { row: 1, column: 4, digit: 6 });

    await expect(call('sudoku_check')).resolves.toEqual({
      wrong: [{ row: 1, column: 3, digit: 1 }],
      emptyCells: 49,
      onTrack: false,
    });
  });

  it('asks for a puzzle before accepting moves', async () => {
    const { store, call } = setup();

    await expect(call('sudoku_write_digit', { row: 1, column: 3, digit: 4 })).resolves.toEqual({
      error: expect.stringMatching(/sudoku_new_puzzle/),
    });
    expect(isSyncedValueDescriptor(store.field)).toBe(false);
  });

  it('rejects positions outside the board', async () => {
    const { call } = setup();
    await call('sudoku_new_puzzle', { difficulty: 'easy' });

    await expect(call('sudoku_write_digit', { row: 0, column: 10, digit: 4 })).resolves.toEqual({
      error: expect.stringMatching(/row[\s\S]*column/),
    });
  });
});
