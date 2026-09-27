import type { TAnyColumn } from '@frozik/table/core/columns/column';
import type { IRowQuery } from '@frozik/table/core/rows/row-query';
import type { ISnapshotParams, TSnapshotEvent } from '@frozik/table/core/rows/snapshot-rows';
import { resolveColumnFilter } from '@frozik/table/extensions/filtering/specs/default';
import { compareByKind } from '@frozik/table/extensions/sorting/compare';
import { isNil } from 'lodash-es';

import type { IDemoTrade } from '../domain/demo-trade';
import { seededRandom } from '../domain/random';

export interface IFakeSnapshotServerOptions {
  readonly rows: () => readonly IDemoTrade[];
  readonly columns: () => readonly TAnyColumn<IDemoTrade>[];
  readonly latencyMs?: number;
  readonly deltaEveryMs?: number;
  readonly log?: (text: string) => void;
}

const DEFAULT_LATENCY_MS = 400;
const DEFAULT_DELTA_EVERY_MS = 1_500;
const PRICE_JITTER = 0.002;
const UPSERTS_PER_TICK = 3;

/** Applies the same filter specs and comparators the client uses, the way a real backend would with SQL. */
function applyQuery(
  rows: readonly IDemoTrade[],
  query: IRowQuery,
  columns: readonly TAnyColumn<IDemoTrade>[]
): readonly IDemoTrade[] {
  const predicates = Object.entries(query.filters).flatMap(([columnId, model]) => {
    const column = columns.find(candidate => candidate.id === columnId);
    const spec = column === undefined ? undefined : resolveColumnFilter(column);
    return column === undefined || spec === undefined || spec.kind !== model.kind
      ? []
      : [(row: IDemoTrade) => spec.predicate(model as never)(column.value(row), row)];
  });
  const filtered =
    predicates.length === 0 ? rows : rows.filter(row => predicates.every(test => test(row)));
  if (query.sort.length === 0) {
    return filtered;
  }
  return [...filtered].sort((left, right) => {
    for (const item of query.sort) {
      const column = columns.find(candidate => candidate.id === item.columnId);
      if (column === undefined) {
        continue;
      }
      const order = compareByKind(column.kind, column.value(left), column.value(right));
      if (order !== 0) {
        return item.direction === 'asc' ? order : -order;
      }
    }
    return 0;
  });
}

/**
 * An in-memory server: answers the window after a delay, then keeps pushing
 * price changes as upserts and removes the odd trade, so the deltas path of
 * `snapshotRows` is exercised without a network. The deltas are the server's
 * truth: a later window sees the changed prices and misses the removed rows.
 */
export function fakeSnapshotServer(options: IFakeSnapshotServerOptions) {
  const latency = options.latencyMs ?? DEFAULT_LATENCY_MS;
  const deltaEvery = options.deltaEveryMs ?? DEFAULT_DELTA_EVERY_MS;
  const changed = new Map<number, IDemoTrade>();
  const removed = new Set<number>();
  const current = (): readonly IDemoTrade[] =>
    options
      .rows()
      .filter(trade => !removed.has(trade.id))
      .map(trade => changed.get(trade.id) ?? trade);
  let tick = 0;
  return (
    params: ISnapshotParams<IDemoTrade>,
    emit: (event: TSnapshotEvent<IDemoTrade>) => void
  ): VoidFunction => {
    const { window, query, signal } = params;
    const sortText = query.sort.map(item => `${item.columnId}:${item.direction}`).join(',') || '—';
    options.log?.(
      `subscribe offset=${window.offset} limit=${window.limit} sort=${sortText} filters=${Object.keys(query.filters).length}`
    );
    let ordered = applyQuery(current(), query, options.columns());
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        if (signal.aborted) {
          return;
        }
        const rows = ordered.slice(window.offset, window.offset + window.limit);
        options.log?.(`snapshot ${rows.length} rows, total ${ordered.length}`);
        emit({ kind: 'snapshot', rows, total: ordered.length });
      }, latency)
    );
    const interval = setInterval(() => {
      if (signal.aborted) {
        return;
      }
      tick += 1;
      const random = seededRandom(tick);
      const live = applyQuery(current(), query, options.columns());
      const visible = live.slice(window.offset, window.offset + window.limit);
      if (live.length !== ordered.length) {
        options.log?.(`total ${live.length}`);
        emit({ kind: 'total', total: live.length });
      }
      ordered = live;
      if (visible.length === 0) {
        return;
      }
      const upserts = Array.from(
        { length: UPSERTS_PER_TICK },
        () => visible[Math.floor(random() * visible.length)]
      ).map(trade => ({
        ...trade,
        price: trade.price * (1 + (random() - 0.5) * PRICE_JITTER),
      }));
      for (const trade of upserts) {
        changed.set(trade.id, trade);
      }
      options.log?.(`upsert ${upserts.map(trade => `#${trade.id}`).join(' ')}`);
      emit({ kind: 'upsert', rows: upserts });
      const gone = visible[Math.floor(random() * visible.length)];
      if (!isNil(gone) && tick % 4 === 0 && !removed.has(gone.id)) {
        removed.add(gone.id);
        options.log?.(`remove #${gone.id}`);
        emit({ kind: 'remove', keys: [String(gone.id)] });
      }
    }, deltaEvery);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
      options.log?.(`unsubscribe offset=${window.offset}`);
    };
  };
}
