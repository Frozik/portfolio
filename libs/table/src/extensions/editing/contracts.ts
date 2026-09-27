import type { TBivariantCallback } from '../../core/kernel/callback';

export type TValidationLevel = 'error' | 'warning';

export interface IValidation {
  readonly level: TValidationLevel;
  readonly message: string;
}

/** A string is an error; a warning marks the cell but lets the commit through. */
export type TValidationResult = string | IValidation | undefined;

declare module '../../core/columns/column' {
  interface IColumnDefinition<TRow, TValue> {
    /** `false` or a function returning `false` keeps the cell read-only; a column without `set` is read-only anyway. */
    readonly editable?: boolean | TBivariantCallback<[row: TRow], boolean>;
    validate?(draft: TValue, row: TRow): TValidationResult;
  }
}

/** Value accessors a session works with; a cell may override the column's for its own data. */
export interface ICellAccessors<TRow, TValue = unknown> {
  set(row: TRow, value: TValue): TRow;
  validate?(draft: TValue, row: TRow): TValidationResult;
  equals?(left: TValue, right: TValue): boolean;
}

export interface IEditSession {
  readonly rowKey: string;
  readonly columnId: string;
  readonly draft: unknown;
  /** The key press that opened the editor, for it to start from. */
  readonly initialKey: string | undefined;
  readonly validation: IValidation | undefined;
}

export interface IRowDraft<TRow> {
  readonly original: TRow;
  readonly row: TRow;
  readonly fields: ReadonlySet<string>;
}

export type TCommitMode = 'immediate' | 'draft';

export interface IEditingOptions<TRow> {
  readonly readOnly?: boolean;
  readonly rowEditable?: TBivariantCallback<[row: TRow], boolean>;
  /** `immediate` hands every commit to `onRowChange`; `draft` keeps it until the application settles the row. */
  readonly commitMode?: TCommitMode;
  readonly enterMovesDown?: boolean;
  readonly onEditStart?: (session: IEditSession) => void;
  readonly onEditStop?: (session: IEditSession, committed: boolean) => void;
}

export function normalizeValidation(result: TValidationResult): IValidation | undefined {
  if (result === undefined) {
    return undefined;
  }
  return typeof result === 'string' ? { level: 'error', message: result } : result;
}
