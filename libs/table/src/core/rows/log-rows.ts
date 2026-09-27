import { isEqual } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import type { TDisplayRow } from './display-row';
import { leafRow } from './display-row';
import type { ILiveRowSource, ILogRowsOptions } from './log-contracts';
import { chunkParams, gapParams } from './log-fetch';
import type { TLogDirection } from './log-lanes';
import { appendChunk, farEndTime, freshestTime, insertLive } from './log-lanes';
import { LogLiveLane } from './log-live';
import { runPipeline } from './pipeline';
import type { IRowQuery } from './row-query';
import { EMPTY_QUERY } from './row-query';
import type { IRowRange, IRowSource, IRowSourceContext, TRowSourceFactory } from './row-source';

const DEFAULT_CHUNK_ROWS = 100;
const DEFAULT_RESTORE_MAX = 500;
const DEFAULT_LIVE_BUFFER_MAX = 1_000;

/**
 * Two lanes over one time axis: history grows at the far end chunk by chunk,
 * live rows arrive at the fresh edge. Nothing is ever re-sorted, keys and
 * heights stay put, and the scroll never jumps: live rows wait in a buffer
 * until the user is at the edge.
 */
class LogRowSource<TRow> implements IRowSource<TRow>, ILiveRowSource {
  epoch = 0;
  private query: IRowQuery = EMPTY_QUERY;
  private lane: readonly TRow[] = [];
  private readonly live: LogLiveLane<TRow>;
  private eod = false;
  private loading = false;
  private failure: unknown = undefined;
  private atFreshEdge = true;
  private started = false;
  private range: IRowRange = { start: 0, end: 0 };
  private controller: AbortController | undefined = undefined;
  private unsubscribe: VoidFunction | undefined = undefined;
  private readonly stopGuards: VoidFunction[] = [];
  private readonly chunkRows: number;
  private readonly restoreMax: number;

  constructor(
    private readonly context: IRowSourceContext<TRow>,
    private readonly options: ILogRowsOptions<TRow>
  ) {
    this.chunkRows = options.chunkRows ?? DEFAULT_CHUNK_ROWS;
    this.restoreMax = options.restoreMax ?? DEFAULT_RESTORE_MAX;
    this.live = new LogLiveLane(options.liveBufferMax ?? DEFAULT_LIVE_BUFFER_MAX);
    makeAutoObservable<
      LogRowSource<TRow>,
      | 'context'
      | 'options'
      | 'controller'
      | 'unsubscribe'
      | 'stopGuards'
      | 'chunkRows'
      | 'restoreMax'
      | 'live'
      | 'load'
      | 'restart'
      | 'restoreGap'
      | 'freshEdgeLoaded'
    >(
      this,
      {
        context: false,
        options: false,
        controller: false,
        unsubscribe: false,
        stopGuards: false,
        chunkRows: false,
        restoreMax: false,
        live: false,
        rowAt: false,
        keyAt: false,
        indexOf: false,
        load: false,
        restart: false,
        restoreGap: false,
        freshEdgeLoaded: false,
      },
      { autoBind: true }
    );
    this.stopGuards.push(
      context.guard('sorting.set', ({ sort }) =>
        sort.some(item => item.columnId !== options.timeColumnId) ? 'log.timeOnly' : undefined
      ),
      context.guard('filtering.quick', ({ quick }) =>
        quick.text === '' ? undefined : 'log.quickUnavailable'
      )
    );
  }

  get direction(): TLogDirection {
    const timeSort = this.query.sort.find(item => item.columnId === this.options.timeColumnId);
    return timeSort?.direction === 'asc' ? 'forward' : 'backward';
  }

  get liveStopped(): boolean {
    const till = this.options.range?.till;
    return this.options.subscribe === undefined || (till !== undefined && till < this.now());
  }

  get buffered(): number {
    return this.live.buffered;
  }

  get hasMore(): boolean {
    return !this.eod;
  }

  private get displayRows(): readonly TDisplayRow<TRow>[] {
    return runPipeline(
      this.context.pipeline,
      this.lane.map(row => leafRow(this.context.rowKey(row), row))
    );
  }

  private get indexByKey(): ReadonlyMap<string, number> {
    return new Map(this.displayRows.map((row, index) => [row.key, index]));
  }

  get rowCount(): number | undefined {
    if (!this.started) {
      return undefined;
    }
    return this.displayRows.length + (this.eod ? 0 : 1);
  }

  rowAt(index: number): TDisplayRow<TRow> {
    const displayRow = this.displayRows[index];
    if (displayRow !== undefined) {
      return displayRow;
    }
    return this.failure === undefined
      ? { kind: 'loading', key: `loading:${index}` }
      : { kind: 'failed', key: `failed:${index}`, error: this.failure };
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
    this.restart();
  }

  setRange(range: IRowRange): void {
    this.range = range;
    this.atFreshEdge =
      this.direction === 'backward' ? range.start === 0 : range.end >= this.displayRows.length;
    if (this.atFreshEdge && this.eodOrFresh()) {
      this.flush();
    }
    if (!this.eod && !this.loading && range.end >= this.displayRows.length - this.chunkRows) {
      void this.load();
    }
  }

  refresh(options: { readonly purge?: boolean } = {}): void {
    if (options.purge === true || this.failure !== undefined) {
      this.restart();
      return;
    }
    void this.load();
  }

  flush(): void {
    if (this.live.buffered === 0) {
      return;
    }
    this.join(this.live.take());
  }

  dispose(): void {
    this.controller?.abort();
    this.unsubscribe?.();
    this.stopGuards.forEach(stop => stop());
  }

  private join(rows: readonly TRow[]): void {
    this.lane = insertLive(this.lane, rows, this.context.rowKey, this.options.time, this.direction);
  }

  private now(): string {
    return this.options.now?.() ?? Temporal.Now.instant().toString();
  }

  private restart(): void {
    this.controller?.abort();
    this.unsubscribe?.();
    this.controller = new AbortController();
    this.lane = [];
    this.live.reset();
    this.eod = false;
    this.loading = false;
    this.failure = undefined;
    this.atFreshEdge = true;
    void this.load();
    if (!this.liveStopped) {
      this.subscribeLive();
    }
  }

  private subscribeLive(): void {
    const controller = this.controller;
    if (controller === undefined || this.options.subscribe === undefined) {
      return;
    }
    const epoch = this.epoch;
    this.unsubscribe = this.options.subscribe(
      { query: this.query, signal: controller.signal },
      event => {
        if (controller.signal.aborted || epoch !== this.epoch) {
          return;
        }
        runInAction(() => {
          switch (event.kind) {
            case 'start':
              this.live.start(event.at);
              void this.restoreGap();
              return;
            case 'append':
              this.receiveLive(event.rows);
              return;
            case 'error':
              this.context.reportError(event.error);
              return;
          }
        });
      }
    );
  }

  private receiveLive(rows: readonly TRow[]): void {
    const till = this.options.range?.till;
    const accepted = till === undefined ? rows : rows.filter(row => this.options.time(row) <= till);
    if (accepted.length === 0) {
      return;
    }
    if (this.atFreshEdge && this.eodOrFresh()) {
      this.join(accepted);
      return;
    }
    this.live.hold(accepted);
  }

  /** Live rows may join the lane only once history has met the moment live became complete. */
  private eodOrFresh(): boolean {
    return this.live.startedAt === undefined || this.live.complete;
  }

  private async load(): Promise<void> {
    const controller = this.controller;
    if (controller === undefined || this.loading || this.eod) {
      return;
    }
    const epoch = this.epoch;
    const direction = this.direction;
    const oldest = farEndTime(this.lane, this.options.time);
    const softLimit = Math.max(this.chunkRows, 2 * (this.range.end - this.range.start));
    const params = chunkParams({
      query: this.query,
      direction,
      range: this.options.range,
      oldest,
      softLimit,
      now: this.now(),
      signal: controller.signal,
    });
    runInAction(() => {
      this.loading = true;
    });
    try {
      const chunk = await this.options.fetch(params);
      if (controller.signal.aborted || epoch !== this.epoch) {
        return;
      }
      runInAction(() => {
        this.lane = appendChunk(this.lane, chunk, this.context.rowKey);
        this.eod = chunk.length < softLimit;
        this.failure = undefined;
        this.loading = false;
        if (this.atFreshEdge && this.eodOrFresh()) {
          this.flush();
        }
      });
      if (this.live.startedAt !== undefined && !this.live.complete) {
        void this.restoreGap();
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      runInAction(() => {
        this.loading = false;
        this.failure = error;
      });
      this.context.reportError(error);
    }
  }

  /**
   * Rows between the freshest history row and the moment live became
   * complete; too many means a full reload. Runs once history is there, and
   * only once: after it the lane is complete and live rows join it directly.
   */
  private async restoreGap(): Promise<void> {
    const controller = this.controller;
    const at = this.live.startedAt;
    const freshest = freshestTime(this.lane, this.options.time, this.direction);
    if (
      controller === undefined ||
      at === undefined ||
      freshest === undefined ||
      this.live.restoring ||
      !this.freshEdgeLoaded()
    ) {
      return;
    }
    if (freshest >= at) {
      runInAction(() => this.markLiveComplete());
      return;
    }
    const epoch = this.epoch;
    this.live.restoring = true;
    try {
      const rows = await this.options.fetch(
        gapParams({
          query: this.query,
          direction: this.direction,
          freshest,
          at,
          softLimit: this.restoreMax,
          signal: controller.signal,
        })
      );
      if (controller.signal.aborted || epoch !== this.epoch) {
        return;
      }
      runInAction(() => {
        this.live.restoring = false;
        if (rows.length >= this.restoreMax) {
          this.restart();
          return;
        }
        this.join(rows);
        this.markLiveComplete();
      });
    } catch (error) {
      this.live.restoring = false;
      if (!controller.signal.aborted) {
        this.context.reportError(error);
      }
    }
  }

  /** Backward history starts at the fresh edge; forward history only reaches it at the end of data. */
  private freshEdgeLoaded(): boolean {
    return this.direction === 'backward' ? this.lane.length > 0 : this.eod;
  }

  private markLiveComplete(): void {
    this.live.complete = true;
    if (this.atFreshEdge) {
      this.flush();
    }
  }
}

/** An append-only log by time; see the spec's §6.5. */
export function logRows<TRow>(options: ILogRowsOptions<TRow>): TRowSourceFactory<TRow> {
  return context => new LogRowSource(context, options);
}
