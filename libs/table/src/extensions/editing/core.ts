import { isNil } from 'lodash-es';
import { makeAutoObservable, reaction } from 'mobx';

import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TDisplayRow } from '../../core/rows/display-row';
import type {
  IBeginOptions,
  ICellAccessors,
  IChangeOptions,
  IEditingOptions,
  IEditingSlice,
  IEditSession,
  IRowDraft,
  IValidation,
  TCommitMode,
  TIncomingPolicy,
} from './contracts';
import { columnAccessors, columnAllowsEdit, normalizeValidation } from './contracts';
import { Drafts } from './drafts';

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
    readonly 'editing.confirmed': { readonly rowKey: string };
    readonly 'editing.reverted': { readonly rowKey: string };
  }
}

/** Drafts replace live rows before anything else looks at them. */
export const EDITING_STAGE_ORDER = 50;

class EditingSlice<TRow> implements IEditingSlice<TRow> {
  current: IEditSession | null = null;
  readonly incoming: TIncomingPolicy;
  readonly enterMovesDown: boolean;
  private accessors: ICellAccessors<TRow> | undefined = undefined;
  private readonly options: IEditingOptions<TRow>;
  private readonly rowDrafts: Drafts<TRow>;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IEditingOptions<TRow>
  ) {
    this.options = options;
    this.incoming = options.incoming ?? 'hold';
    this.enterMovesDown = options.enterMovesDown ?? true;
    this.rowDrafts = new Drafts(kernel, options.commitMode ?? 'immediate', this.incoming);
    makeAutoObservable<
      EditingSlice<TRow>,
      | 'kernel'
      | 'options'
      | 'accessors'
      | 'rowDrafts'
      | 'loadedRow'
      | 'accessorsOf'
      | 'validationOf'
    >(
      this,
      {
        kernel: false,
        options: false,
        accessors: false,
        rowDrafts: false,
        isEditing: false,
        reasonAgainst: false,
        isEdited: false,
        apply: false,
        watchedRows: false,
        loadedRow: false,
        accessorsOf: false,
        validationOf: false,
      },
      { autoBind: true }
    );
  }

  get commitMode(): TCommitMode {
    return this.rowDrafts.commitMode;
  }

  setCommitMode(mode: TCommitMode): void {
    this.rowDrafts.setCommitMode(mode);
  }

  get drafts(): ReadonlyMap<string, IRowDraft<TRow>> {
    return this.rowDrafts.drafts;
  }

  get updating(): ReadonlySet<string> {
    return this.rowDrafts.updating;
  }

  get failures(): ReadonlyMap<string, unknown> {
    return this.rowDrafts.failures;
  }

  get pending(): readonly string[] {
    return this.rowDrafts.pending;
  }

  isEditing(rowKey: string, columnId: string): boolean {
    return this.current?.rowKey === rowKey && this.current.columnId === columnId;
  }

  reasonAgainst(rowKey: string, columnId: string): string | undefined {
    if (this.options.readOnly === true) {
      return 'editing.readOnly';
    }
    const column = this.kernel.columns.byId.get(columnId);
    if (column === undefined || column.set === undefined || !column.editable) {
      return 'editing.notEditable';
    }
    const row = this.loadedRow(rowKey);
    if (row === undefined) {
      return 'editing.notLoaded';
    }
    if (this.updating.has(rowKey)) {
      return 'editing.updating';
    }
    if (!columnAllowsEdit(column, row, rowKey) || this.options.rowEditable?.(row) === false) {
      return 'editing.notEditable';
    }
    return this.kernel.commands.reasonAgainst('editing.begin', { rowKey, columnId });
  }

  isEdited(rowKey: string, columnId?: string): boolean {
    return this.rowDrafts.isEdited(rowKey, columnId);
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
      this.rowDrafts.hold(rowKey, row);
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
    return this.write(session.rowKey, session.columnId, session.draft, accessors, row, () =>
      this.stop(session, true)
    ).ok;
  }

  change(options: IChangeOptions<TRow>): TCommandOutcome {
    const { rowKey, columnId, value } = options;
    const reason = this.reasonAgainst(rowKey, columnId);
    if (reason !== undefined) {
      return { ok: false, reason };
    }
    if (this.isEditing(rowKey, columnId)) {
      this.cancel();
    }
    const column = this.kernel.columns.byId.get(columnId);
    const row = this.loadedRow(rowKey);
    const accessors = options.accessors ?? this.accessorsOf(columnId);
    if (column === undefined || row === undefined || accessors === undefined) {
      return { ok: false, reason: 'editing.notEditable' };
    }
    const validation = normalizeValidation(accessors.validate?.(value, row));
    if (validation?.level === 'error') {
      return { ok: false, reason: 'editing.invalid' };
    }
    const equals = accessors.equals ?? Object.is;
    if (equals(value, column.value(row))) {
      return { ok: true };
    }
    return this.write(rowKey, columnId, value, accessors, row, () => undefined);
  }

  cancel(): void {
    if (this.current !== null) {
      this.stop(this.current, false);
    }
  }

  confirm(rowKey: string): void {
    this.rowDrafts.confirm(rowKey);
  }

  revert(rowKey: string): void {
    this.rowDrafts.revert(rowKey);
  }

  confirmAll(): void {
    this.rowDrafts.confirmAll();
  }

  revertAll(): void {
    this.rowDrafts.revertAll();
  }

  apply(rows: readonly TDisplayRow<TRow>[]): readonly TDisplayRow<TRow>[] {
    return this.rowDrafts.apply(rows);
  }

  /** The display rows behind every edit in flight; they are rebuilt on each pipeline run, so a reaction on them sees every new version. */
  watchedRows(): readonly (TDisplayRow<TRow> | undefined)[] {
    const keys = [...this.pending, ...(this.current === null ? [] : [this.current.rowKey])];
    return keys.map(rowKey => {
      const index = this.kernel.rows.indexOf(rowKey);
      return isNil(index) ? undefined : this.kernel.rows.rowAt(index);
    });
  }

  /** `apply` policy: a row that arrived anew loses its unconfirmed edit and closes the session on it. */
  reconcile(): void {
    for (const rowKey of this.rowDrafts.staleKeys()) {
      this.rowDrafts.revert(rowKey);
    }
    if (this.rowDrafts.sessionRowStale()) {
      this.cancel();
    }
  }

  /** The one path every value takes into the application: `set`, the draft record, then `onRowsChange`. */
  private write(
    rowKey: string,
    columnId: string,
    value: unknown,
    accessors: ICellAccessors<TRow>,
    row: TRow,
    onWritten: () => void
  ): TCommandOutcome {
    return this.kernel.commands.run('editing.commit', { rowKey, columnId, draft: value }, () => {
      const next = accessors.set(row, value);
      onWritten();
      this.rowDrafts.record(rowKey, columnId, row, next);
    });
  }

  private stop(session: IEditSession, committed: boolean): void {
    this.current = null;
    this.accessors = undefined;
    this.rowDrafts.release();
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
    return column === undefined ? undefined : columnAccessors(column);
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
      const stopReconciling =
        slice.incoming === 'apply'
          ? reaction(
              () => slice.watchedRows(),
              () => slice.reconcile()
            )
          : () => undefined;
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
                  run: () => slice.revert(rowKey),
                },
              ],
        keys: [
          {
            key: 'Escape',
            target: 'cell',
            run: () => slice.current !== null && (slice.cancel(), true),
          },
        ],
        dispose: stopReconciling,
      };
    },
  };
}
