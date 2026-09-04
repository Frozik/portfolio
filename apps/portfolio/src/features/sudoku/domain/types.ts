export enum EFieldType {
  Fixed = 'fixed',
  Guess = 'guess',
}

export enum ECellStatus {
  Unknown = 'unknown',
  Wrong = 'wrong',
}

export interface IFieldCell {
  readonly type: EFieldType;
  readonly value: number | undefined;
  readonly notes: readonly number[];
  readonly status: ECellStatus;
}

/** A `size`×`size` grid of `size`×`size` groups; `cells` is row-major over `size²` rows. */
export interface IField {
  readonly size: number;
  readonly cells: readonly IFieldCell[];
}

export type ToolMode = 'pen' | 'notes';

/** The active number, if any, and how a click applies it. The mode outlives the number. */
export interface ITool {
  readonly mode: ToolMode;
  readonly value: number | undefined;
}

export type SudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
