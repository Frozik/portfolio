import { filtering } from '../../extensions/filtering/core';
import { sorting } from '../../extensions/sorting/core';
import { column } from '../columns/column';
import { createTable } from '../create-table';
import type { ILogFetchParams, TLogLiveEvent } from './log-contracts';
import { logRows } from './log-rows';

type TEvent = { readonly id: number; readonly at: string; readonly text: string };

const define = column<TEvent>();

function at(second: number): string {
  return `2026-09-28T10:00:${String(second).padStart(2, '0')}Z`;
}

function event(second: number): TEvent {
  return { id: second, at: at(second), text: `event ${second}` };
}

function harness(
  options: {
    readonly history?: readonly TEvent[];
    readonly chunkRows?: number;
    readonly live?: boolean;
  } = {}
) {
  const history = options.history ?? Array.from({ length: 30 }, (_, index) => event(index + 1));
  const fetches: ILogFetchParams[] = [];
  const emitters: ((event: TLogLiveEvent<TEvent>) => void)[] = [];
  const model = createTable({
    columns: [
      define({ id: 'at', title: 'Time', kind: 'datetime', value: row => row.at }),
      define({ id: 'text', title: 'Text', kind: 'text', value: row => row.text, filter: true }),
    ],
    rowKey: 'id',
    rows: logRows<TEvent>({
      time: row => row.at,
      timeColumnId: 'at',
      chunkRows: options.chunkRows ?? 10,
      now: () => at(59),
      fetch: params => {
        fetches.push(params);
        const within = history.filter(row => {
          const afterFrom = params.fromExclusive ? row.at > params.from : row.at >= params.from;
          const beforeTill = params.tillExclusive ? row.at < params.till : row.at <= params.till;
          return afterFrom && beforeTill;
        });
        const ordered = params.direction === 'backward' ? [...within].reverse() : within;
        return Promise.resolve(ordered.slice(0, params.softLimit));
      },
      subscribe:
        options.live === false
          ? undefined
          : (_, emit) => {
              emitters.push(emit);
              return () => undefined;
            },
    }),
    extensions: [sorting(), filtering()],
    context: undefined,
  });
  return { model, fetches, emitters };
}

async function settled(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

function ids(model: ReturnType<typeof harness>['model']): readonly number[] {
  return Array.from({ length: model.rows.rowCount ?? 0 }, (_, index) => {
    const row = model.rows.rowAt(index);
    return row.kind === 'leaf' ? row.row.id : -1;
  });
}

describe('logRows', () => {
  it('loads history newest first, keeps a skeleton at the open end and fetches the next chunk near it', async () => {
    const { model, fetches } = harness();
    model.rows.setRange({ start: 0, end: 5 });
    await settled();
    expect(fetches[0]).toMatchObject({
      direction: 'backward',
      till: at(59),
      tillExclusive: false,
      softLimit: 10,
    });
    expect(ids(model).slice(0, 3)).toEqual([30, 29, 28]);
    expect(model.rows.hasMore).toBe(true);
    expect(model.rows.rowCount).toBe(11);
    expect(model.rows.rowAt(10).kind).toBe('loading');

    model.rows.setRange({ start: 4, end: 10 });
    await settled();
    expect(fetches[1]).toMatchObject({ till: at(21), tillExclusive: true, softLimit: 12 });
    expect(ids(model)).toHaveLength(23);
  });

  it('reaches the end of data with a short chunk and reports no more rows', async () => {
    const { model } = harness({ history: [event(1), event(2), event(3)] });
    model.rows.setRange({ start: 0, end: 5 });
    await settled();
    expect(model.rows.hasMore).toBe(false);
    expect(ids(model)).toEqual([3, 2, 1]);
  });

  it('inserts live rows at the fresh edge when the user is there and buffers them otherwise', async () => {
    const { model, emitters } = harness();
    model.rows.setRange({ start: 0, end: 5 });
    await settled();
    emitters[0]({ kind: 'start', at: at(30) });
    await settled();
    emitters[0]({ kind: 'append', rows: [event(31)] });
    expect(ids(model)[0]).toBe(31);

    model.rows.setRange({ start: 3, end: 8 });
    emitters[0]({ kind: 'append', rows: [event(32), event(33)] });
    expect(ids(model)[0]).toBe(31);
    const live = model.rows as unknown as { readonly buffered: number; flush(): void };
    expect(live.buffered).toBe(2);
    live.flush();
    expect(ids(model).slice(0, 3)).toEqual([33, 32, 31]);
  });

  it('fills the gap between history and the moment live became complete', async () => {
    const { model, emitters, fetches } = harness({
      history: Array.from({ length: 40 }, (_, index) => event(index + 1)),
    });
    model.rows.setRange({ start: 0, end: 5 });
    await settled();
    expect(ids(model)[0]).toBe(40);
    emitters[0]({ kind: 'start', at: at(45) });
    await settled();
    expect(fetches.at(-1)).toMatchObject({ from: at(40), fromExclusive: true, till: at(45) });
  });

  it('sorts only by time and refuses the quick filter, with reasons the UI can show', () => {
    const { model } = harness();
    expect(model.sorting.set([{ columnId: 'text', direction: 'asc' }])).toEqual({
      ok: false,
      reason: 'log.timeOnly',
    });
    expect(model.filtering.setQuick({ text: 'x' })).toEqual({
      ok: false,
      reason: 'log.quickUnavailable',
    });
    expect(model.sorting.set([{ columnId: 'at', direction: 'asc' }]).ok).toBe(true);
  });

  it('flips direction with the time sort and starts a new epoch', async () => {
    const { model, fetches } = harness();
    model.rows.setRange({ start: 0, end: 5 });
    await settled();
    model.sorting.set([{ columnId: 'at', direction: 'asc' }]);
    await settled();
    expect(model.rows.epoch).toBe(2);
    expect(fetches.at(-1)?.direction).toBe('forward');
    expect(ids(model).slice(0, 3)).toEqual([1, 2, 3]);

    model.rows.setRange({ start: 4, end: 10 });
    await settled();
    expect(fetches.at(-1)).toMatchObject({
      direction: 'forward',
      from: at(10),
      fromExclusive: true,
    });
    expect(ids(model).slice(0, 22)).toEqual(Array.from({ length: 22 }, (_, index) => index + 1));
  });

  it('in forward order buffers live rows until history reaches its end, then restores the gap once', async () => {
    const { model, emitters, fetches } = harness({
      history: Array.from({ length: 15 }, (_, index) => event(index + 1)),
    });
    model.rows.setRange({ start: 0, end: 5 });
    await settled();
    model.sorting.set([{ columnId: 'at', direction: 'asc' }]);
    await settled();
    emitters.at(-1)?.({ kind: 'start', at: at(20) });
    emitters.at(-1)?.({ kind: 'append', rows: [event(21)] });
    await settled();
    const live = model.rows as unknown as { readonly buffered: number };
    expect(live.buffered).toBe(1);
    expect(fetches.filter(fetch => fetch.till === at(20))).toHaveLength(0);

    model.rows.setRange({ start: 4, end: 11 });
    await settled();
    expect(model.rows.hasMore).toBe(false);
    expect(fetches.filter(fetch => fetch.till === at(20))).toHaveLength(1);
    model.rows.setRange({ start: 10, end: 17 });
    expect(live.buffered).toBe(0);
    expect(ids(model).at(-1)).toBe(21);
    expect(model.rows.epoch).toBe(2);
  });

  it('keeps live rows out of the lane until the gap to the live start is restored, without showing a chip meanwhile', async () => {
    const { model, emitters, fetches } = harness({
      history: Array.from({ length: 40 }, (_, index) => event(index + 1)),
    });
    emitters[0]({ kind: 'start', at: at(45) });
    model.rows.setRange({ start: 0, end: 5 });
    await settled();
    expect(fetches.at(-1)).toMatchObject({ from: at(40), fromExclusive: true, till: at(45) });
    emitters[0]({ kind: 'append', rows: [event(46)] });
    await settled();
    expect(ids(model)[0]).toBe(46);
    const live = model.rows as unknown as { readonly buffered: number };
    expect(live.buffered).toBe(0);
  });
});
