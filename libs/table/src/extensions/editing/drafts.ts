import { makeAutoObservable, runInAction } from 'mobx';

import type { ITableKernel } from '../../core/kernel/kernel';
import type { TDisplayRow } from '../../core/rows/display-row';
import type { IRowChange } from '../../core/rows/row-change';
import type { IRowDraft, TCommitMode, TIncomingPolicy } from './contracts';

interface ISessionRow<TRow> {
  readonly rowKey: string;
  readonly row: TRow;
}

/**
 * Edited rows on top of the live ones. A draft shows until the application
 * confirms it; while `onRowsChange` runs its rows count as updating. Under
 * the `hold` policy the row of the open session and every draft stay as the
 * user saw them; under `apply` a newer live version shows through and the
 * stale edit is dropped by the extension's reaction.
 */
export class Drafts<TRow> {
  drafts: ReadonlyMap<string, IRowDraft<TRow>> = new Map();
  updating: ReadonlySet<string> = new Set();
  failures: ReadonlyMap<string, unknown> = new Map();
  sessionRow: ISessionRow<TRow> | null = null;
  commitMode: TCommitMode;
  /** The live rows behind the keys of interest, as the pipeline last saw them. */
  private readonly liveByKey = new Map<string, TRow>();

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    commitMode: TCommitMode,
    private readonly incoming: TIncomingPolicy
  ) {
    this.commitMode = commitMode;
    makeAutoObservable<Drafts<TRow>, 'kernel' | 'incoming' | 'liveByKey'>(
      this,
      {
        kernel: false,
        incoming: false,
        liveByKey: false,
        apply: false,
        staleKeys: false,
        sessionRowStale: false,
      },
      { autoBind: true }
    );
  }

  get pending(): readonly string[] {
    return [...this.drafts.keys()];
  }

  isEdited(rowKey: string, columnId?: string): boolean {
    const draft = this.drafts.get(rowKey);
    return draft !== undefined && (columnId === undefined || draft.fields.has(columnId));
  }

  setCommitMode(mode: TCommitMode): void {
    this.commitMode = mode;
  }

  hold(rowKey: string, row: TRow): void {
    this.sessionRow = { rowKey, row };
  }

  release(): void {
    this.sessionRow = null;
  }

  /** Records the edited row and, in immediate mode, hands it to the application at once. */
  record(rowKey: string, columnId: string, row: TRow, next: TRow): void {
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
    if (this.commitMode === 'immediate') {
      this.send([rowKey]);
    }
  }

  confirm(rowKey: string): void {
    if (this.drafts.has(rowKey) && !this.updating.has(rowKey)) {
      this.send([rowKey]);
    }
  }

  confirmAll(): void {
    const keys = this.pending.filter(key => !this.updating.has(key));
    if (keys.length > 0) {
      this.send(keys);
    }
  }

  revert(rowKey: string): void {
    if (this.drop(rowKey)) {
      this.kernel.events.emit('editing.reverted', { rowKey });
    }
  }

  revertAll(): void {
    for (const rowKey of this.pending) {
      this.revert(rowKey);
    }
  }

  apply(rows: readonly TDisplayRow<TRow>[]): readonly TDisplayRow<TRow>[] {
    const session = this.sessionRow;
    if (this.drafts.size === 0 && session === null) {
      return rows;
    }
    return rows.map(displayRow => {
      if (displayRow.kind !== 'leaf') {
        return displayRow;
      }
      const draft = this.drafts.get(displayRow.key);
      const held = session?.rowKey === displayRow.key ? session.row : undefined;
      if (draft === undefined && held === undefined) {
        return displayRow;
      }
      this.liveByKey.set(displayRow.key, displayRow.row);
      const shown =
        draft !== undefined && (this.incoming === 'hold' || draft.original === displayRow.row)
          ? draft.row
          : held !== undefined && this.incoming === 'hold'
            ? held
            : displayRow.row;
      return shown === displayRow.row ? displayRow : { ...displayRow, row: shown };
    });
  }

  /** Drafts whose row arrived anew from the source since the edit. */
  staleKeys(): readonly string[] {
    return this.pending.filter(key => {
      const live = this.liveByKey.get(key);
      return live !== undefined && live !== this.drafts.get(key)?.original;
    });
  }

  sessionRowStale(): boolean {
    const session = this.sessionRow;
    if (session === null) {
      return false;
    }
    const live = this.liveByKey.get(session.rowKey);
    return live !== undefined && live !== session.row;
  }

  private drop(rowKey: string): boolean {
    if (!this.drafts.has(rowKey)) {
      return false;
    }
    const drafts = new Map(this.drafts);
    drafts.delete(rowKey);
    this.drafts = drafts;
    this.liveByKey.delete(rowKey);
    return true;
  }

  private send(keys: readonly string[]): void {
    const changes = keys.flatMap((rowKey): IRowChange<TRow>[] => {
      const draft = this.drafts.get(rowKey);
      return draft === undefined
        ? []
        : [{ old: draft.original, new: draft.row, rowKey, fields: [...draft.fields] }];
    });
    const result = this.kernel.changeRows(changes);
    if (!(result instanceof Promise)) {
      this.settle(keys);
      return;
    }
    this.updating = new Set([...this.updating, ...keys]);
    result.then(
      () =>
        runInAction(() => {
          this.markUpdated(keys);
          this.settle(keys);
        }),
      (error: unknown) =>
        runInAction(() => {
          this.markUpdated(keys);
          this.failures = new Map([...this.failures, ...keys.map(key => [key, error] as const)]);
          for (const rowKey of keys) {
            this.revert(rowKey);
          }
          this.kernel.reportSourceError(error);
        })
    );
  }

  private settle(keys: readonly string[]): void {
    for (const rowKey of keys) {
      if (this.drop(rowKey)) {
        this.kernel.events.emit('editing.confirmed', { rowKey });
      }
    }
  }

  private markUpdated(keys: readonly string[]): void {
    const updating = new Set(this.updating);
    for (const rowKey of keys) {
      updating.delete(rowKey);
    }
    this.updating = updating;
  }
}
