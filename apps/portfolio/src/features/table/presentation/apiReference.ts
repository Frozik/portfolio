export type TApiSource = 'snapshot' | 'log';

export type TSnapshotSection = 'subscribe' | 'events' | 'window' | 'epoch' | 'deltas' | 'errors';
export type TLogSection =
  | 'options'
  | 'fetch'
  | 'subscribe'
  | 'direction'
  | 'gaps'
  | 'buffer'
  | 'filters';

/** The wire contracts, quoted from `@frozik/table` so the reference never drifts from the types. */
export const SNAPSHOT_API: Readonly<Record<TSnapshotSection, string>> = {
  subscribe: `snapshotRows<TRow>({
  subscribe: (params: ISnapshotParams<TRow>, emit) => VoidFunction,
  pageRows?: number,      // 100 — window rounded out to whole pages
  bufferRows?: number,    // 50 — rows kept above and below the viewport
  debounceMs?: number,    // 300 — scrolling re-subscribes after a pause
  cursor?: boolean,       // params.after = the row before the window
  keepStaleOn?: (error) => boolean,
  refreshOn?: (refresh: () => void) => VoidFunction,
})

interface ISnapshotParams<TRow> {
  readonly window: { offset: number; limit: number };
  readonly query: IRowQuery;   // sort, filters, quick, extra
  readonly after?: TRow;
  readonly signal: AbortSignal;
}`,
  events: `type TSnapshotEvent<TRow> =
  | { kind: 'snapshot'; rows: readonly TRow[]; total?: number }
  | { kind: 'upsert'; rows: readonly TRow[] }
  | { kind: 'remove'; keys: readonly string[] }
  | { kind: 'total'; total: number }
  | { kind: 'error'; error: unknown };`,
  window: `// visible rows 12…24, pageRows 100, bufferRows 50
window = { offset: 0, limit: 100 }
// scrolled to rows 260…300
window = { offset: 200, limit: 200 }`,
  epoch: `model.rows.epoch      // grows on every query change
model.rows.rowCount   // total ± local deltas, or undefined
model.rows.hasMore    // total unknown and the last snapshot was full`,
  deltas: `// the same stages the client pipeline runs:
upsert → filtering predicates → sorting comparators → window
remove → by key`,
  errors: `emit({ kind: 'error', error })
// keepStaleOn(error) === true  → rows stay, model.rows.isStale
// otherwise                    → the window shows failed placeholders
// every error reaches onSourceError(error) of the table`,
};

export const LOG_API: Readonly<Record<TLogSection, string>> = {
  options: `logRows<TRow>({
  time: (row: TRow) => string,   // ISO time of the event
  timeColumnId: string,          // the only sortable column
  fetch: (params: ILogFetchParams) => Promise<readonly TRow[]>,
  subscribe?: (params, emit) => VoidFunction,
  range?: { from?: string; till?: string },
  chunkRows?: number,     // 100
  restoreMax?: number,    // 500
  liveBufferMax?: number, // 1000
})`,
  fetch: `interface ILogFetchParams {
  readonly query: IRowQuery;
  readonly from: string;  readonly fromExclusive: boolean;
  readonly till: string;  readonly tillExclusive: boolean;
  readonly softLimit: number;   // may be exceeded to keep one timestamp together
  readonly direction: 'forward' | 'backward';
  readonly signal: AbortSignal;
}`,
  subscribe: `type TLogLiveEvent<TRow> =
  | { kind: 'start'; at: string }          // live is complete from this moment
  | { kind: 'append'; rows: readonly TRow[] }
  | { kind: 'error'; error: unknown };`,
  direction: `sort: []                                → 'backward' (newest first)
sort: [{ columnId: 'at', direction: 'asc' }] → 'forward'  (oldest first)
sort by any other column                   → refused: 'log.timeOnly'`,
  gaps: `history … [freshest]  ← gap →  [at] … live
// the gap is fetched once, up to restoreMax rows;
// more than that means a full reload of both lanes`,
  buffer: `// away from the fresh edge, live rows wait:
model.rows.buffered   // how many
model.rows.flush()    // let them in (the chip does this and scrolls)`,
  filters: `quick filter → refused: 'log.quickUnavailable'
column filters → sent to the server in query.filters
range.till in the past → live stream stopped`,
};
