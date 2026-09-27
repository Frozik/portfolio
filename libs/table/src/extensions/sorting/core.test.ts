import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { sorting } from './core';

type TTrade = { readonly id: number; readonly symbol: string; readonly price: number | null };

const trades: TTrade[] = [
  { id: 1, symbol: 'ETH', price: 20 },
  { id: 2, symbol: 'BTC', price: null },
  { id: 3, symbol: 'ADA', price: 5 },
  { id: 4, symbol: 'BTC', price: 30 },
];

const define = column<TTrade>();

function table(multi: 'shift' | 'always' | 'never' = 'shift') {
  return createTable({
    columns: [
      define({ id: 'symbol', title: 'Symbol', kind: 'text', value: row => row.symbol }),
      define({ id: 'price', title: 'Price', kind: 'number', value: row => row.price }),
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id, sort: false }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => trades }),
    extensions: [sorting({ multi })],
    context: undefined,
  });
}

function keys(model: ReturnType<typeof table>): readonly string[] {
  return Array.from({ length: model.rows.rowCount ?? 0 }, (_, index) => model.rows.keyAt(index));
}

describe('sorting', () => {
  it('cycles a column through ascending, descending and off on repeated toggles', () => {
    const model = table();

    model.sorting.toggle('price');
    expect(keys(model)).toEqual(['3', '1', '4', '2']);
    expect(model.sorting.directionOf('price')).toBe('asc');

    model.sorting.toggle('price');
    expect(keys(model)).toEqual(['4', '1', '3', '2']);

    model.sorting.toggle('price');
    expect(keys(model)).toEqual(['1', '2', '3', '4']);
    expect(model.sorting.sort).toEqual([]);
  });

  it('adds a second column only with the multi modifier and reports priorities', () => {
    const model = table();
    model.sorting.toggle('symbol');
    model.sorting.toggle('price', { multi: true });

    expect(keys(model)).toEqual(['3', '4', '2', '1']);
    expect(model.sorting.priorityOf('symbol')).toBe(1);
    expect(model.sorting.priorityOf('price')).toBe(2);

    model.sorting.toggle('price');
    expect(model.sorting.sort).toEqual([{ columnId: 'price', direction: 'desc' }]);
  });

  it('refuses a column that opted out of sorting and explains why', () => {
    const model = table();
    expect(model.sorting.reasonAgainst('id')).toBe('sorting.disabled');
    expect(model.sorting.toggle('id')).toEqual({ ok: false, reason: 'sorting.disabled' });
  });

  it('is part of the query, the state and can be restored from it', () => {
    const model = table();
    model.sorting.set([{ columnId: 'symbol', direction: 'desc' }]);

    expect(model.query.sort).toEqual([{ columnId: 'symbol', direction: 'desc' }]);
    expect(model.state.extensions).toEqual({
      sorting: [{ columnId: 'symbol', direction: 'desc' }],
    });

    model.resetState();
    expect(model.sorting.sort).toEqual([]);

    model.applyState({ extensions: { sorting: [{ columnId: 'price', direction: 'asc' }] } });
    expect(keys(model)).toEqual(['3', '1', '4', '2']);
  });
});
