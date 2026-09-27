import { debounce, isEqual } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { TDisplayRow } from './display-row';
import { leafRow } from './display-row';
import { runPipeline } from './pipeline';
import type { IRowQuery } from './row-query';
import { EMPTY_QUERY } from './row-query';
import type { IRowRange, IRowSource, IRowSourceContext, TRowSourceFactory } from './row-source';
import type { IWindow } from './snapshot-window';
import { overlapOf, sameWindow, windowFor } from './snapshot-window';

export type TSnapshotEvent<TRow> =
  | { readonly kind: 'snapshot'; readonly rows: readonly TRow[]; readonly total?: number }
  | { readonly kind: 'upsert'; readonly rows: readonly TRow[] }
  | { readonly kind: 'remove'; readonly keys: readonly string[] }
  | { readonly kind: 'total'; readonly total: number }
  | { readonly kind: 'error'; readonly error: unknown };

export interface ISnapshotParams<TRow> {
  readonly window: IWindow;
  readonly query: IRowQuery;
  /** The row just before the window, for servers that page by cursor. */
  readonly after?: TRow;
  readonly signal: AbortSignal;
}

export type TSnapshotSubscribe<TRow> = (
  params: ISnapshotParams<TRow>,
  emit: (event: TSnapshotEvent<TRow>) => void
) => VoidFunction;

export interface ISnapshotRowsOptions<TRow> {
  readonly subscribe: TSnapshotSubscribe<TRow>;
  readonly pageRows?: number;
  readonly bufferRows?: number;
  readonly debounceMs?: number;
  readonly cursor?: boolean;
  /** Errors after which the rows stay on screen, marked stale, instead of turning into failures. */
  readonly keepStaleOn?: (error: unknown) => boolean;
  /** An outside tick ("something changed") that re-subscribes the current window. */
  readonly refreshOn?: (refresh: () => void) => VoidFunction;
}

const DEFAULT_PAGE_ROWS = 100;
const DEFAULT_BUFFER_ROWS = 50;
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * One contiguous window the server knows about, replaced on scroll and on
 * every new query (epoch). Deltas go through the same pipeline stages as
 * client rows: a filter drops what no longer matches, the sort places what
 * arrives, so the server never has to re-send the window.
 */
class SnapshotRowSource<TRow> implements IRowSource<TRow> {
  epoch = 0;
  private query: IRowQuery = EMPTY_QUERY;
  private window: IWindow | undefined = undefined;
  /** A window change waiting out the scroll debounce; a query change applies it instead of dropping it. */
  private pendingWindow: IWindow | undefined = undefined;
  private rows: readonly TRow[] = [];
  private total: number | undefined = undefined;
  private loaded = false;
  private endReached = false;
  private snapshotCount = 0;
  private failure: unknown = undefined;
  private stale = false;
  private started = false;
  private controller: AbortController | undefined = undefined;
  private unsubscribe: VoidFunction | undefined = undefined;
  private readonly stopRefreshOn: VoidFunction | undefined;
  private readonly pageRows: number;
  private readonly bufferRows: number;
  private readonly applyWindowLater: ReturnType<typeof debounce<(window: IWindow) => void>>;

  constructor(
    private readonly context: IRowSourceContext<TRow>,
    private readonly options: ISnapshotRowsOptions<TRow>
  ) {
    this.pageRows = options.pageRows ?? DEFAULT_PAGE_ROWS;
    this.bufferRows = options.bufferRows ?? DEFAULT_BUFFER_ROWS;
    this.applyWindowLater = debounce(
      (window: IWindow) => this.applyWindow(window),
      options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    );
    makeAutoObservable<
      SnapshotRowSource<TRow>,
      | 'context'
      | 'options'
      | 'controller'
      | 'unsubscribe'
      | 'stopRefreshOn'
      | 'pageRows'
      | 'bufferRows'
      | 'applyWindowLater'
      | 'pendingWindow'
      | 'resubscribe'
    >(
      this,
      {
        context: false,
        options: false,
        controller: false,
        unsubscribe: false,
        stopRefreshOn: false,
        pageRows: false,
        bufferRows: false,
        applyWindowLater: false,
        pendingWindow: false,
        resubscribe: false,
        rowAt: false,
        keyAt: false,
        indexOf: false,
      },
      { autoBind: true }
    );
    this.stopRefreshOn = options.refreshOn?.(() => this.refresh());
  }

  private get displayRows(): readonly TDisplayRow<TRow>[] {
    return runPipeline(
      this.context.pipeline,
      this.rows.map(row => leafRow(this.context.rowKey(row), row))
    );
  }

  private get indexByKey(): ReadonlyMap<string, number> {
    const offset = this.window?.offset ?? 0;
    return new Map(this.displayRows.map((row, index) => [row.key, offset + index]));
  }

  get hasMore(): boolean {
    return this.total === undefined && !this.endReached;
  }

  get rowCount(): number | undefined {
    const window = this.window;
    if (
      window === undefined ||
      (!this.loaded && this.rows.length === 0 && this.failure === undefined)
    ) {
      return this.total;
    }
    const loadedEnd = window.offset + this.displayRows.length;
    if (this.total !== undefined) {
      return Math.max(loadedEnd, this.total + (this.displayRows.length - this.snapshotCount));
    }
    return this.endReached ? loadedEnd : loadedEnd + this.pageRows;
  }

  /** Whether the rows on screen may be behind the server after a tolerated error. */
  get isStale(): boolean {
    return this.stale;
  }

  rowAt(index: number): TDisplayRow<TRow> {
    const offset = this.window?.offset ?? 0;
    const displayRow = this.displayRows[index - offset];
    if (displayRow !== undefined) {
      return displayRow;
    }
    if (this.failure !== undefined && !this.stale) {
      return { kind: 'failed', key: `failed:${index}`, error: this.failure };
    }
    return { kind: 'loading', key: `loading:${index}` };
  }

  keyAt(index: number): string {
    return this.rowAt(index).key;
  }

  indexOf(rowKey: string): number | undefined {
    return this.indexByKey.get(rowKey);
  }

  setQuery(query: IRowQuery): void {
    if (this.started && isEqual(query, this.query)) {
      return;
    }
    this.started = true;
    this.query = query;
    this.epoch += 1;
    this.rows = [];
    this.total = undefined;
    this.loaded = false;
    this.endReached = false;
    this.snapshotCount = 0;
    this.failure = undefined;
    this.stale = false;
    const pending = this.pendingWindow;
    this.applyWindowLater.cancel();
    this.pendingWindow = undefined;
    if (pending !== undefined) {
      this.applyWindow(pending);
    } else if (this.window !== undefined) {
      this.resubscribe(undefined);
    }
  }

  setRange(range: IRowRange): void {
    const next = windowFor(range, this.pageRows, this.bufferRows);
    if (sameWindow(this.window, next)) {
      this.applyWindowLater.cancel();
      this.pendingWindow = undefined;
      return;
    }
    if (this.window === undefined) {
      this.applyWindow(next);
      return;
    }
    this.pendingWindow = next;
    this.applyWindowLater(next);
  }

  refresh(options: { readonly purge?: boolean } = {}): void {
    if (options.purge === true) {
      this.rows = [];
      this.loaded = false;
    }
    this.failure = undefined;
    if (this.window !== undefined && this.started) {
      this.resubscribe(undefined);
    }
  }

  dispose(): void {
    this.applyWindowLater.cancel();
    this.stopRefreshOn?.();
    this.controller?.abort();
    this.unsubscribe?.();
  }

  private applyWindow(window: IWindow): void {
    this.pendingWindow = undefined;
    if (sameWindow(this.window, window)) {
      return;
    }
    const previous =
      this.window === undefined ? undefined : { window: this.window, rows: this.rows };
    const after =
      this.options.cursor === true &&
      previous !== undefined &&
      window.offset > previous.window.offset
        ? previous.rows[window.offset - 1 - previous.window.offset]
        : undefined;
    this.window = window;
    this.rows = overlapOf(previous, window);
    this.loaded = false;
    this.endReached = false;
    if (this.started) {
      this.resubscribe(after);
    }
  }

  private resubscribe(after: TRow | undefined): void {
    this.controller?.abort();
    this.unsubscribe?.();
    const window = this.window;
    if (window === undefined) {
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    const epoch = this.epoch;
    this.unsubscribe = this.options.subscribe(
      { window, query: this.query, after, signal: controller.signal },
      event => {
        if (controller.signal.aborted || epoch !== this.epoch) {
          return;
        }
        runInAction(() => this.handle(event, window));
      }
    );
  }

  private handle(event: TSnapshotEvent<TRow>, window: IWindow): void {
    switch (event.kind) {
      case 'snapshot':
        this.rows = event.rows;
        this.total = event.total ?? this.total;
        this.loaded = true;
        this.endReached = event.rows.length < window.limit;
        this.snapshotCount = this.displayRows.length;
        this.failure = undefined;
        this.stale = false;
        return;
      case 'upsert': {
        const incoming = new Map(event.rows.map(row => [this.context.rowKey(row), row]));
        const kept = this.rows.map(row => incoming.get(this.context.rowKey(row)) ?? row);
        const known = new Set(this.rows.map(row => this.context.rowKey(row)));
        const added = event.rows.filter(row => !known.has(this.context.rowKey(row)));
        this.rows = [...kept, ...added].slice(0, window.limit + this.bufferRows);
        return;
      }
      case 'remove': {
        const removed = new Set(event.keys);
        this.rows = this.rows.filter(row => !removed.has(this.context.rowKey(row)));
        return;
      }
      case 'total':
        this.total = event.total;
        this.snapshotCount = this.displayRows.length;
        return;
      case 'error':
        this.context.reportError(event.error);
        if (this.options.keepStaleOn?.(event.error) === true) {
          this.stale = true;
          return;
        }
        this.rows = [];
        this.loaded = false;
        this.failure = event.error;
        return;
    }
  }
}

/** A server-side window with deltas; see the spec's §6.4 for the contract every server adapter implements. */
export function snapshotRows<TRow>(options: ISnapshotRowsOptions<TRow>): TRowSourceFactory<TRow> {
  return context => new SnapshotRowSource(context, options);
}
