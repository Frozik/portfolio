import { observable, runInAction } from 'mobx';

import { clientRows } from './client-rows';
import type { TDisplayRow } from './display-row';
import type { IPipelineStage } from './pipeline';

type TItem = { readonly id: number; readonly name: string };

const items: TItem[] = [
  { id: 1, name: 'ash' },
  { id: 2, name: 'birch' },
  { id: 3, name: 'cedar' },
];

function reverse<TRow>(): IPipelineStage<TRow> {
  return { order: 1, apply: rows => [...rows].reverse() };
}

describe('clientRows', () => {
  it('exposes every application row as a leaf keyed by rowKey, in order', () => {
    const source = clientRows({ rows: () => items })({
      rowKey: row => `k${row.id}`,
      pipeline: [],
      reportError: () => undefined,
      guard: () => () => undefined,
    });

    expect(source.rowCount).toBe(3);
    expect(source.keyAt(0)).toBe('k1');
    expect(source.rowAt(2)).toEqual<TDisplayRow<TItem>>({ kind: 'leaf', key: 'k3', row: items[2] });
    expect(source.indexOf('k2')).toBe(1);
  });

  it('runs the extension pipeline and the external filter over the rows', () => {
    const source = clientRows<TItem>({ rows: () => items, externalFilter: row => row.id !== 2 })({
      rowKey: row => String(row.id),
      pipeline: [reverse()],
      reportError: () => undefined,
      guard: () => () => undefined,
    });

    expect([0, 1].map(index => source.keyAt(index))).toEqual(['3', '1']);
    expect(source.rowCount).toBe(2);
  });

  it('follows the application store when its rows change', () => {
    const store = observable({ rows: items as readonly TItem[] });
    const source = clientRows({ rows: () => store.rows })({
      rowKey: row => String(row.id),
      pipeline: [],
      reportError: () => undefined,
      guard: () => () => undefined,
    });

    runInAction(() => {
      store.rows = [items[0]];
    });

    expect(source.rowCount).toBe(1);
    expect(source.indexOf('3')).toBeUndefined();
  });

  it('answers a loading placeholder outside the known rows', () => {
    const source = clientRows({ rows: () => items })({
      rowKey: row => String(row.id),
      pipeline: [],
      reportError: () => undefined,
      guard: () => () => undefined,
    });
    expect(source.rowAt(10).kind).toBe('loading');
  });
});
