import type { IColumnDefinition } from '../../core/columns/column';
import type { TBivariantCallback } from '../../core/kernel/callback';
import type { TCommandOutcome } from '../../core/kernel/command-bus';

export type TValidationLevel = 'error' | 'warning';

export interface IValidation {
  readonly level: TValidationLevel;
  readonly message: string;
}

/** A string is an error; a warning marks the cell but lets the commit through. */
export type TValidationResult = string | IValidation | undefined;

/** What a column's `editable` rule sees: the row and the cell on it. */
export interface IEditableContext<TRow, TValue = unknown> {
  readonly row: TRow;
  readonly rowKey: string;
  readonly value: TValue;
  readonly columnId: string;
}

declare module '../../core/columns/column' {
  interface IColumnDefinition<TRow, TValue> {
    /** Opt-in: `true`, or a rule over the row and the cell; absent or `false` keeps the cell read-only even with `set`. */
    readonly editable?:
      | boolean
      | TBivariantCallback<[context: IEditableContext<TRow, TValue>], boolean>;
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

export type TCommitMode = 'immediate' | 'confirm';

/** What happens to a row that arrives anew from the source while it is edited or has unconfirmed edits. */
export type TIncomingPolicy = 'hold' | 'apply';

export interface IEditingOptions<TRow> {
  readonly readOnly?: boolean;
  readonly rowEditable?: TBivariantCallback<[row: TRow], boolean>;
  /** `immediate` hands every commit to `onRowsChange`; `confirm` keeps the edits of a row until `confirm(rowKey)`. */
  readonly commitMode?: TCommitMode;
  /** `hold` keeps showing what is being edited until the edit ends; `apply` shows the new version and drops the edit. */
  readonly incoming?: TIncomingPolicy;
  readonly enterMovesDown?: boolean;
  readonly onEditStart?: (session: IEditSession) => void;
  readonly onEditStop?: (session: IEditSession, committed: boolean) => void;
}

export interface IBeginOptions<TRow> {
  readonly rowKey: string;
  readonly columnId: string;
  readonly initialKey?: string;
  readonly accessors?: ICellAccessors<TRow>;
}

/** A value a cell produced on its own, without a session: a control inside the cell, or a cell that edits itself. */
export interface IChangeOptions<TRow> {
  readonly rowKey: string;
  readonly columnId: string;
  readonly value: unknown;
  readonly accessors?: ICellAccessors<TRow>;
}

export interface IEditingSlice<TRow> {
  readonly current: IEditSession | null;
  readonly commitMode: TCommitMode;
  /** Switches how commits reach the application; edits already pending stay until confirmed. */
  setCommitMode(mode: TCommitMode): void;
  readonly incoming: TIncomingPolicy;
  readonly enterMovesDown: boolean;
  readonly drafts: ReadonlyMap<string, IRowDraft<TRow>>;
  readonly pending: readonly string[];
  readonly updating: ReadonlySet<string>;
  readonly failures: ReadonlyMap<string, unknown>;
  isEditing(rowKey: string, columnId: string): boolean;
  reasonAgainst(rowKey: string, columnId: string): string | undefined;
  isEdited(rowKey: string, columnId?: string): boolean;
  begin(options: IBeginOptions<TRow>): TCommandOutcome;
  update(draft: unknown): void;
  commit(): boolean;
  change(options: IChangeOptions<TRow>): TCommandOutcome;
  cancel(): void;
  /** The row API a control in a cell calls in `confirm` mode: hand the row's edits to the application, or drop them. */
  confirm(rowKey: string): void;
  revert(rowKey: string): void;
  confirmAll(): void;
  revertAll(): void;
}

/** The accessors a column declares, or `undefined` for a column without `set`. */
export function columnAccessors<TRow>(
  column: IColumnDefinition<TRow, unknown>
): ICellAccessors<TRow> | undefined {
  if (column.set === undefined) {
    return undefined;
  }
  return {
    set: (row, value) => column.set?.(row, value) ?? row,
    validate:
      column.validate === undefined ? undefined : (draft, row) => column.validate?.(draft, row),
    equals:
      column.equals === undefined
        ? undefined
        : (left, right) => column.equals?.(left, right) ?? false,
  };
}

/** The column's own rule; the kernel adds the table rules, the row state and the guards. */
export function columnAllowsEdit<TRow>(
  column: IColumnDefinition<TRow, unknown>,
  row: TRow,
  rowKey: string
): boolean {
  const { editable } = column;
  if (column.set === undefined || editable === undefined || editable === false) {
    return false;
  }
  return (
    editable === true || editable({ row, rowKey, value: column.value(row), columnId: column.id })
  );
}

export function normalizeValidation(result: TValidationResult): IValidation | undefined {
  if (result === undefined) {
    return undefined;
  }
  return typeof result === 'string' ? { level: 'error', message: result } : result;
}
