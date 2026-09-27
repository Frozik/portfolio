import { filtering } from '../../extensions/filtering/core';
import { sorting } from '../../extensions/sorting/core';
import { column } from '../columns/column';
import { createTable } from '../create-table';
import type { ISnapshotParams, TSnapshotEvent } from './snapshot-rows';
import { snapshotRows } from './snapshot-rows';

type TItem = { readonly id: number; readonly name: string; readonly price: number };

const define = column<TItem>();

function item(id: number): TItem {
  return { id, name: `item ${id}`, price: id * 10 };
}

function harness(options: { readonly total?: number; readonly keepStale?: boolean } = {}) {
  const calls: ISnapshotParams<TItem>[] = [];
  const emitters: ((event: TSnapshotEvent<TItem>) => void)[] = [];
  const unsubscribed: number[] = [];
  const errors: unknown[] = [];
  const model = createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name, filter: true }),
      define({ id: 'price', title: 'Price', kind: 'number', value: row => row.price }),
    ],
    rowKey: 'id',
    rows: snapshotRows<TItem>({
      pageRows: 10,
      bufferRows: 5,
      debounceMs: 0,
      keepStaleOn: () => options.keepStale === true,
      subscribe: (params, emit) => {
        calls.push(params);
        emitters.push(emit);
        const index = calls.length;
        return () => void unsubscribed.push(index);
      },
    }),
    extensions: [sorting(), filtering()],
    context: undefined,
    onSourceError: error => void errors.push(error),
  });
  const emitLast = (event: TSnapshotEvent<TItem>): void => emitters[emitters.length - 1](event);
  const snapshot = (from: number, count: number): void =>
    emitLast({
      kind: 'snapshot',
      rows: Array.from({ length: count }, (_, at) => item(from + at)),
      total: options.total,
    });
  return { model, calls, emitters, emitLast, snapshot, unsubscribed, errors };
}

function namesAt(
  model: ReturnType<typeof harness>['model'],
  from: number,
  to: number
): readonly string[] {
  return Array.from({ length: to - from }, (_, at) => {
    const row = model.rows.rowAt(from + at);
    return row.kind === 'leaf' ? row.row.name : row.kind;
  });
}

describe('snapshotRows', () => {
  it('subscribes for the window of the visible range and shows placeholders until the snapshot lands', () => {
    const { model, calls, snapshot } = harness({ total: 1000 });
    expect(model.rows.rowCount).toBeUndefined();
    model.rows.setRange({ start: 0, end: 8 });
    expect(calls.at(-1)?.window).toEqual({ offset: 0, limit: 20 });
    expect(model.rows.rowAt(0).kind).toBe('loading');

    snapshot(1, 20);
    expect(model.rows.rowCount).toBe(1000);
    expect(namesAt(model, 0, 2)).toEqual(['item 1', 'item 2']);
    expect(model.rows.rowAt(500).kind).toBe('loading');
  });

  it('starts a new epoch on a query change and drops events of the old subscription', () => {
    const { model, calls, emitters, snapshot, unsubscribed } = harness({ total: 100 });
    model.rows.setRange({ start: 0, end: 8 });
    snapshot(1, 20);
    const staleEmit = emitters[0];
    model.sorting.set([{ columnId: 'price', direction: 'desc' }]);
    expect(model.rows.epoch).toBe(2);
    expect(unsubscribed).toEqual([1]);
    expect(calls.at(-1)?.query.sort).toEqual([{ columnId: 'price', direction: 'desc' }]);
    expect(model.rows.rowAt(0).kind).toBe('loading');

    staleEmit({ kind: 'snapshot', rows: [item(99)], total: 1 });
    expect(model.rows.rowAt(0).kind).toBe('loading');
  });

  it('applies deltas through the client pipeline: filtered rows leave, new rows take their sorted place', () => {
    const { model, emitLast, snapshot } = harness({ total: 3 });
    model.sorting.set([{ columnId: 'price', direction: 'asc' }]);
    model.rows.setRange({ start: 0, end: 3 });
    snapshot(1, 3);
    emitLast({
      kind: 'upsert',
      rows: [
        { id: 2, name: 'gone', price: 5 },
        { id: 4, name: 'item 4', price: 15 },
      ],
    });
    expect(namesAt(model, 0, 4)).toEqual(['gone', 'item 1', 'item 4', 'item 3']);
    expect(model.rows.rowCount).toBe(4);

    model.filtering.set('name', {
      kind: 'text',
      join: 'and',
      conditions: [{ op: 'startsWith', text: 'item' }],
    });
    snapshot(1, 3);
    emitLast({ kind: 'upsert', rows: [{ id: 2, name: 'gone', price: 5 }] });
    expect(namesAt(model, 0, 2)).toEqual(['item 1', 'item 3']);
    emitLast({ kind: 'remove', keys: ['1'] });
    expect(namesAt(model, 0, 1)).toEqual(['item 3']);
    expect(model.rows.rowCount).toBe(1);
  });

  it('keeps the overlapping rows on screen while the next window loads and re-subscribes with the new window', async () => {
    vi.useFakeTimers();
    const { model, calls, snapshot } = harness({ total: 100 });
    model.rows.setRange({ start: 0, end: 8 });
    snapshot(1, 20);
    model.rows.setRange({ start: 12, end: 24 });
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.at(-1)?.window).toEqual({ offset: 0, limit: 30 });
    expect(namesAt(model, 0, 1)).toEqual(['item 1']);
    expect(model.rows.rowAt(25).kind).toBe('loading');
    vi.useRealTimers();
  });

  it('lets the table grow one page past the window while the total is unknown, until a short snapshot', () => {
    const { model, snapshot } = harness();
    model.rows.setRange({ start: 0, end: 8 });
    snapshot(1, 20);
    expect(model.rows.hasMore).toBe(true);
    expect(model.rows.rowCount).toBe(30);
    snapshot(1, 7);
    expect(model.rows.hasMore).toBe(false);
    expect(model.rows.rowCount).toBe(7);
  });

  it('reports errors; keeps the rows as stale when asked, fails the window otherwise', () => {
    const stale = harness({ total: 20, keepStale: true });
    stale.model.rows.setRange({ start: 0, end: 8 });
    stale.snapshot(1, 20);
    stale.emitLast({ kind: 'error', error: new Error('unavailable') });
    expect(stale.errors).toHaveLength(1);
    expect(stale.model.rows.rowAt(0).kind).toBe('leaf');

    const failing = harness({ total: 20 });
    failing.model.rows.setRange({ start: 0, end: 8 });
    failing.snapshot(1, 20);
    failing.emitLast({ kind: 'error', error: new Error('down') });
    expect(failing.model.rows.rowAt(0).kind).toBe('failed');
  });

  it('forgets a pending window change when the range returns to the current window', async () => {
    vi.useFakeTimers();
    const { model, calls, snapshot } = harness({ total: 100 });
    model.rows.setRange({ start: 0, end: 8 });
    snapshot(1, 20);
    model.rows.setRange({ start: 40, end: 48 });
    model.rows.setRange({ start: 0, end: 8 });
    await vi.advanceTimersByTimeAsync(5);
    expect(calls).toHaveLength(1);
    expect(namesAt(model, 0, 1)).toEqual(['item 1']);
    vi.useRealTimers();
  });

  it('applies a pending window change at once when the query changes, instead of dropping it', async () => {
    vi.useFakeTimers();
    const { model, calls, snapshot } = harness({ total: 100 });
    model.rows.setRange({ start: 0, end: 8 });
    snapshot(1, 20);
    model.rows.setRange({ start: 40, end: 48 });
    model.sorting.set([{ columnId: 'price', direction: 'desc' }]);
    expect(calls).toHaveLength(2);
    expect(calls[1].window).toEqual({ offset: 30, limit: 30 });
    expect(calls[1].query.sort).toEqual([{ columnId: 'price', direction: 'desc' }]);
    vi.useRealTimers();
  });
});
