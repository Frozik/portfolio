import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import type { IDetailRowsOptions } from './core';
import { detailRows } from './core';

type TItem = { readonly id: number; readonly name: string; readonly fills: number };

const items: TItem[] = [
  { id: 1, name: 'cedar', fills: 2 },
  { id: 2, name: 'ash', fills: 0 },
];

const define = column<TItem>();

function table(options: IDetailRowsOptions<TItem> = {}) {
  return createTable({
    columns: [define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name })],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [detailRows<TItem>({ hasDetail: row => row.fills > 0, ...options })],
    context: undefined,
  });
}

describe('detail rows', () => {
  it('adds a service column, opens rows that have a detail and reports their extent', () => {
    const model = table();
    expect(model.columns.visible[0].id).toBe('detail');
    expect(model.detailRows.toggle('2')).toEqual({ ok: false, reason: 'detail.none' });
    expect(model.detailRows.toggle('1')).toEqual({ ok: true });
    expect(model.rowExtent('1')).toBeGreaterThan(0);
    model.detailRows.measure('1', 240);
    expect(model.rowExtent('1')).toBe(240);
    model.detailRows.toggle('1');
    expect(model.rowExtent('1')).toBe(0);
  });

  it('keeps a single row open when asked and persists the open rows only when asked', () => {
    const single = table({ single: true });
    single.detailRows.toggle('1');
    single.detailRows.toggle('1', true);
    expect([...single.detailRows.expanded]).toEqual(['1']);
    expect(single.state.extensions.detailRows).toBeUndefined();

    const persisted = table({ persistExpanded: true, detailHeight: 100 });
    persisted.detailRows.toggle('1');
    expect(persisted.state.extensions.detailRows).toEqual(['1']);
    expect(persisted.rowExtent('1')).toBe(100);
  });
});
