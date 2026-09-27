import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TDisplayRow } from '../../core/rows/display-row';
import type {
  ICellAccessors,
  IEditingOptions,
  IEditSession,
  IRowDraft,
  IValidation,
  TCommitMode,
} from './contracts';
import { normalizeValidation } from './contracts';

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'editing.begin': { readonly rowKey: string; readonly columnId: string };
    readonly 'editing.commit': {
      readonly rowKey: string;
      readonly columnId: string;
      readonly draft: unknown;
    };
  }
  interface ITableEvents {
    readonly 'editing.started': IEditSession;
    readonly 'editing.stopped': { readonly session: IEditSession; readonly committed: boolean };
    readonly 'editing.settled': { readonly rowKey: string };
  }
}

/** Drafts replace live rows before anything else looks at them. */
export const EDITING_STAGE_ORDER = 50;

export interface IBeginOptions<TRow> {
  readonly rowKey: string;
  readonly columnId: string;
  readonly initialKey?: string;
  readonly accessors?: ICellAccessors<TRow>;
}

export interface IEditingSlice<TRow> {
  readonly current: IEditSession | null;
  readonly commitMode: TCommitMode;
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
  cancel(): void;
  settle(rowKey: string): void;
  discard(rowKey: string): void;
  settleAll(): void;
  discardAll(): void;
}

class EditingSlice<TRow> implements IEditingSlice<TRow> {
  current: IEditSession | null = null;
  drafts: ReadonlyMap<string, IRowDraft<TRow>> = new Map();
  updating: ReadonlySet<string> = new Set();
  failures: ReadonlyMap<string, unknown> = new Map();
  readonly commitMode: TCommitMode;
  readonly enterMovesDown: boolean;
  private accessors: ICellAccessors<TRow> | undefined = undefined;
  private readonly options: IEditingOptions<TRow>;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IEditingOptions<TRow>
  ) {
    this.options = options;
    this.commitMode = options.commitMode ?? 'immediate';
    this.enterMovesDown = options.enterMovesDown ?? true;
    makeAutoObservable<
      EditingSlice<TRow>,
      'kernel' | 'options' | 'accessors' | 'loadedRow' | 'accessorsOf' | 'validationOf'
    >(
      this,
      {
        kernel: false,
        options: false,
        accessors: false,
        isEditing: false,
        reasonAgainst: false,
        isEdited: false,
        apply: false,
        loadedRow: false,
        accessorsOf: false,
        validationOf: false,
      },
      { autoBind: true }
    );
  }

  get pending(): readonly string[] {
    return [...this.drafts.keys()];
  }

  isEditing(rowKey: string, columnId: string): boolean {
    return this.current?.rowKey === rowKey && this.current.columnId === columnId;
  }

  reasonAgainst(rowKey: string, columnId: string): string | undefined {
    if (this.options.readOnly === true) {
      return 'editing.readOnly';
    }
    const column = this.kernel.columns.byId.get(columnId);
    if (column === undefined || column.set === undefined || column.editable === false) {
      return 'editing.notEditable';
    }
    const row = this.loadedRow(rowKey);
    if (row === undefined) {
      return 'editing.notLoaded';
    }
    if (this.updating.has(rowKey)) {
      return 'editing.updating';
    }
    if (
      (typeof column.editable === 'function' && !column.editable(row)) ||
      this.options.rowEditable?.(row) === false
    ) {
      return 'editing.notEditable';
    }
    return this.kernel.commands.reasonAgainst('editing.begin', { rowKey, columnId });
  }

  isEdited(rowKey: string, columnId?: string): boolean {
    const draft = this.drafts.get(rowKey);
    return draft !== undefined && (columnId === undefined || draft.fields.has(columnId));
  }

  begin(options: IBeginOptions<TRow>): TCommandOutcome {
    const { rowKey, columnId } = options;
    const reason = this.reasonAgainst(rowKey, columnId);
    if (reason !== undefined) {
      return { ok: false, reason };
    }
    if (this.current !== null) {
      this.commit();
    }
    return this.kernel.commands.run('editing.begin', { rowKey, columnId }, () => {
      const column = this.kernel.columns.byId.get(columnId);
      const row = this.loadedRow(rowKey);
      if (column === undefined || row === undefined) {
        return;
      }
      this.accessors = options.accessors;
      const session: IEditSession = {
        rowKey,
        columnId,
        draft: column.value(row),
        initialKey: options.initialKey,
        validation: undefined,
      };
      this.current = session;
      this.options.onEditStart?.(session);
      this.kernel.events.emit('editing.started', session);
    });
  }

  update(draft: unknown): void {
    if (this.current === null) {
      return;
    }
    this.current = { ...this.current, draft, validation: this.validationOf(this.current, draft) };
  }

  commit(): boolean {
    const session = this.current;
    if (session === null) {
      return false;
    }
    const column = this.kernel.columns.byId.get(session.columnId);
    const row = this.loadedRow(session.rowKey);
    const accessors = this.accessorsOf(session.columnId);
    if (column === undefined || row === undefined || accessors === undefined) {
      this.stop(session, false);
      return false;
    }
    const validation = this.validationOf(session, session.draft);
    if (validation?.level === 'error') {
      this.current = { ...session, validation };
      return false;
    }
    const equals = accessors.equals ?? Object.is;
    if (equals(session.draft, column.value(row))) {
      this.stop(session, false);
      return true;
    }
    const outcome = this.kernel.commands.run(
      'editing.commit',
      { rowKey: session.rowKey, columnId: session.columnId, draft: session.draft },
      () => {
        const next = accessors.set(row, session.draft);
        this.recordDraft(session.rowKey, session.columnId, row, next);
        this.stop(session, true);
        if (this.commitMode === 'immediate') {
          this.send(session.rowKey, session.columnId, next);
        }
      }
    );
    return outcome.ok;
  }

  cancel(): void {
    if (this.current !== null) {
      this.stop(this.current, false);
    }
  }

  settle(rowKey: string): void {
    const drafts = new Map(this.drafts);
    drafts.delete(rowKey);
    this.drafts = drafts;
    this.kernel.events.emit('editing.settled', { rowKey });
  }

  discard(rowKey: string): void {
    this.settle(rowKey);
  }

  settleAll(): void {
    for (const rowKey of this.pending) {
      this.settle(rowKey);
    }
  }

  discardAll(): void {
    this.settleAll();
  }

  apply(rows: readonly TDisplayRow<TRow>[]): readonly TDisplayRow<TRow>[] {
    if (this.drafts.size === 0) {
      return rows;
    }
    return rows.map(displayRow => {
      const draft = displayRow.kind === 'leaf' ? this.drafts.get(displayRow.key) : undefined;
      return draft === undefined ? displayRow : { ...displayRow, row: draft.row };
    });
  }

  private send(rowKey: string, columnId: string, next: TRow): void {
    const draft = this.drafts.get(rowKey);
    const original = draft?.original ?? next;
    const result = this.kernel.changeRow({ row: original, next, rowKey, columnId });
    if (!(result instanceof Promise)) {
      this.settle(rowKey);
      return;
    }
    this.updating = new Set([...this.updating, rowKey]);
    result.then(
      () =>
        runInAction(() => {
          this.markUpdated(rowKey);
          this.settle(rowKey);
        }),
      (error: unknown) =>
        runInAction(() => {
          this.markUpdated(rowKey);
          this.discard(rowKey);
          this.failures = new Map([...this.failures, [rowKey, error]]);
          this.kernel.reportSourceError(error);
        })
    );
  }

  private markUpdated(rowKey: string): void {
    const updating = new Set(this.updating);
    updating.delete(rowKey);
    this.updating = updating;
  }

  private recordDraft(rowKey: string, columnId: string, row: TRow, next: TRow): void {
    const existing = this.drafts.get(rowKey);
    const failures = new Map(this.failures);
    failures.delete(rowKey);
    this.failures = failures;
    this.drafts = new Map([
      ...this.drafts,
      [
        rowKey,
        {
          original: existing?.original ?? row,
          row: next,
          fields: new Set([...(existing?.fields ?? []), columnId]),
        },
      ],
    ]);
  }

  private stop(session: IEditSession, committed: boolean): void {
    this.current = null;
    this.accessors = undefined;
    this.options.onEditStop?.(session, committed);
    this.kernel.events.emit('editing.stopped', { session, committed });
  }

  /** The row as the cell sees it: the draft when there is one. */
  private loadedRow(rowKey: string): TRow | undefined {
    const index = this.kernel.rows.indexOf(rowKey);
    const displayRow = isNil(index) ? undefined : this.kernel.rows.rowAt(index);
    return displayRow?.kind === 'leaf' ? displayRow.row : undefined;
  }

  private accessorsOf(columnId: string): ICellAccessors<TRow> | undefined {
    if (this.accessors !== undefined) {
      return this.accessors;
    }
    const column = this.kernel.columns.byId.get(columnId);
    if (column?.set === undefined) {
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

  private validationOf(session: IEditSession, draft: unknown): IValidation | undefined {
    const row = this.loadedRow(session.rowKey);
    const validate = this.accessorsOf(session.columnId)?.validate;
    return row === undefined || validate === undefined
      ? undefined
      : normalizeValidation(validate(draft, row));
  }
}

export function editing<TRow = never>(
  options: IEditingOptions<TRow> = {}
): ITableExtension<TRow, 'editing', IEditingSlice<TRow>> {
  return {
    id: 'editing',
    create(kernel): IExtensionInstance<TRow, IEditingSlice<TRow>> {
      const slice = new EditingSlice(kernel, options);
      return {
        slice,
        pipeline: { order: EDITING_STAGE_ORDER, apply: rows => slice.apply(rows) },
        menu: ({ target, rowKey }) =>
          target !== 'cell' || rowKey === undefined || !slice.isEdited(rowKey)
            ? []
            : [
                {
                  id: 'editing.discard',
                  label: 'menu.edit.discard',
                  section: 'rows',
                  danger: true,
                  run: () => slice.discard(rowKey),
                },
              ],
        keys: [
          {
            key: 'Escape',
            target: 'cell',
            run: () => slice.current !== null && (slice.cancel(), true),
          },
        ],
        dispose: () => undefined,
      };
    },
  };
}
