import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  EMPTY_VD,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { cloneDeep, isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import {
  addFieldMarks,
  applyToolToFieldReducer,
  cleanPuzzle,
  hasMarks,
  loadField,
  removeFieldMarks,
} from '../domain/services';
import type { IField, TTool } from '../domain/types';
import { EToolType } from '../domain/types';

export class SudokuStore {
  field: ValueDescriptor<IField> = EMPTY_VD;
  tool: TTool = { type: EToolType.None, value: undefined };
  history: IField[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get hasHistory(): boolean {
    return this.history.length > 0;
  }

  resetPuzzle(): void {
    this.field = EMPTY_VD;
    this.history = [];
  }

  restartPuzzle(): void {
    if (!isSyncedValueDescriptor(this.field)) {
      return;
    }

    this.field = createSyncedValueDescriptor(cleanPuzzle(this.field.value));
    this.history = [];
  }

  loadPuzzle(puzzle: string): void {
    this.field = loadField(puzzle);
    this.history = [];
  }

  setTool(tool: TTool): void {
    if (!isNil(this.tool.value) && this.tool.value === tool.value && this.tool.type === tool.type) {
      this.tool = { type: EToolType.None, value: undefined };
      return;
    }

    this.tool = tool;
  }

  applyTool(row: number, column: number): void {
    if (
      !isSyncedValueDescriptor(this.field) ||
      this.field.value.size === 0 ||
      this.tool.type === EToolType.None
    ) {
      return;
    }

    // Clone BEFORE applying tool — applyToolToFieldReducer may shallow-mutate
    // nested arrays (e.g. notes) in the original field via shared references.
    const snapshot = cloneDeep(this.field.value);
    const newField = applyToolToFieldReducer(this.field.value, this.tool, row, column);

    if (this.field.value !== newField) {
      this.history = [...this.history, snapshot];
    }

    this.field = createSyncedValueDescriptor(newField);
  }

  markField(): void {
    if (!isSyncedValueDescriptor(this.field) || this.field.value.size === 0) {
      return;
    }

    this.history = [...this.history, cloneDeep(this.field.value)];

    if (hasMarks(this.field.value)) {
      this.field = createSyncedValueDescriptor(removeFieldMarks(this.field.value));
    } else {
      this.field = createSyncedValueDescriptor(addFieldMarks(this.field.value));
    }
  }

  restorePreviousState(): void {
    if (this.history.length === 0) {
      return;
    }

    const previousState = this.history[this.history.length - 1];
    this.history = this.history.slice(0, -1);

    this.field = createSyncedValueDescriptor(previousState);
  }
}
