import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  EMPTY_VD,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isNil, last } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { IPuzzleGenerator } from '../domain/ports/puzzle-generator';
import {
  addFieldMarks,
  applyToolToFieldReducer,
  cleanPuzzle,
  hasMarks,
  loadField,
  removeFieldMarks,
} from '../domain/services';
import type { IField, ITool, SudokuDifficulty, ToolMode } from '../domain/types';

export class SudokuStore {
  field: ValueDescriptor<IField> = EMPTY_VD;
  tool: ITool = { mode: 'pen', value: undefined };
  history: readonly IField[] = [];

  constructor(private readonly puzzleGenerator: IPuzzleGenerator) {
    makeAutoObservable<SudokuStore, 'puzzleGenerator'>(
      this,
      { puzzleGenerator: false },
      { autoBind: true }
    );
  }

  get hasHistory(): boolean {
    return this.history.length > 0;
  }

  createPuzzle(difficulty: SudokuDifficulty): string {
    return this.puzzleGenerator.generate(difficulty);
  }

  resetPuzzle(): void {
    this.field = EMPTY_VD;
    this.history = [];
  }

  restartPuzzle(): void {
    if (isSyncedValueDescriptor(this.field)) {
      this.field = createSyncedValueDescriptor(cleanPuzzle(this.field.value));
      this.history = [];
    }
  }

  loadPuzzle(puzzle: string): void {
    this.field = loadField(puzzle);
    this.history = [];
  }

  /** Selecting the active number again deselects it; the mode stays. */
  setToolValue(value: number): void {
    this.tool = { ...this.tool, value: this.tool.value === value ? undefined : value };
  }

  setToolMode(mode: ToolMode): void {
    this.tool = { ...this.tool, mode };
  }

  applyTool(row: number, column: number): void {
    this.applyToolAt(row, column, this.tool);
  }

  /** Applies a tool other than the keypad's, so an agent's move leaves the player's selection alone. */
  applyToolAt(row: number, column: number, tool: ITool): void {
    if (!isSyncedValueDescriptor(this.field) || isNil(tool.value)) {
      return;
    }
    const previousField = this.field.value;
    const nextField = applyToolToFieldReducer(previousField, tool, row, column);
    if (previousField !== nextField) {
      this.history = [...this.history, previousField];
    }
    this.field = createSyncedValueDescriptor(nextField);
  }

  /** Toggles candidate notes: fills them when none exist, clears them otherwise. */
  markField(): void {
    this.replaceField(field => (hasMarks(field) ? removeFieldMarks(field) : addFieldMarks(field)));
  }

  /** Notes every legal candidate in every cell, replacing whatever notes were there. */
  fillMarks(): void {
    this.replaceField(addFieldMarks);
  }

  private replaceField(edit: (field: IField) => IField): void {
    if (!isSyncedValueDescriptor(this.field)) {
      return;
    }
    const field = this.field.value;
    this.history = [...this.history, field];
    this.field = createSyncedValueDescriptor(edit(field));
  }

  restorePreviousState(): void {
    const previousState = last(this.history);
    if (isNil(previousState)) {
      return;
    }
    this.history = this.history.slice(0, -1);
    this.field = createSyncedValueDescriptor(previousState);
  }

  dispose(): void {}
}
