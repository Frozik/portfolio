import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { filtering } from '../filtering/core';
import { sorting } from '../sorting/core';
import type { IGroupingOptions } from './core';
import { grouping } from './core';

type TItem = {
  readonly id: number;
  readonly symbol: string;
  readonly side: 'buy' | 'sell';
  readonly quantity: number;
};

const items: TItem[] = [
  { id: 1, symbol: 'ETH', side: 'buy', quantity: 2 },
  { id: 2, symbol: 'BTC', side: 'sell', quantity: 1 },
  { id: 3, symbol: 'ETH', side: 'sell', quantity: 4 },
  { id: 4, symbol: 'BTC', side: 'buy', quantity: 3 },
  { id: 5, symbol: 'ETH', side: 'buy', quantity: 5 },
];

const define = column<TItem>();

function table(options: IGroupingOptions<TItem> = {}) {
  return createTable({
    columns: [
      define({
        id: 'symbol',
        title: 'Symbol',
        kind: 'text',
        value: row => row.symbol,
        filter: true,
      }),
      define({ id: 'side', title: 'Side', kind: 'text', value: row => row.side }),
      define({
        id: 'quantity',
        title: 'Quantity',
        kind: 'number',
        value: row => row.quantity,
        aggregate: 'sum',
      }),
      define({
        id: 'id',
        title: 'Id',
        kind: 'number',
        value: row => row.id,
        aggregate: 'count',
        groupable: false,
      }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [filtering(), grouping<TItem>(options), sorting()],
    context: undefined,
  });
}

function outline(model: ReturnType<typeof table>): readonly string[] {
  return Array.from({ length: model.rows.rowCount ?? 0 }, (_, index) => {
    const row = model.rows.rowAt(index);
    if (row.kind === 'group') {
      return `${'  '.repeat(row.group.level)}${row.group.title} (${row.group.count})`;
    }
    return row.kind === 'leaf'
      ? `${'  '.repeat(model.grouping.groupBy.length)}#${row.row.id}`
      : '?';
  });
}

describe('grouping', () => {
  it('nests groups by the chosen columns in title order with every leaf under its expanded group', () => {
    const model = table({ groupBy: ['symbol', 'side'] });
    expect(outline(model)).toEqual([
      'BTC (2)',
      '  buy (1)',
      '    #4',
      '  sell (1)',
      '    #2',
      'ETH (3)',
      '  buy (2)',
      '    #1',
      '    #5',
      '  sell (1)',
      '    #3',
    ]);
  });

  it('aggregates the declared columns per group and for the totals row', () => {
    const model = table({ groupBy: ['symbol'], totals: { position: 'bottom', title: 'Total' } });
    const first = model.rows.rowAt(0);
    expect(first.kind === 'group' && first.group.aggregates).toEqual({ quantity: 4, id: 2 });
    const [totals] = model.pinnedBottom;
    expect(totals.kind === 'group' && totals.group.aggregates).toEqual({ quantity: 15, id: 5 });
    model.filtering.set('symbol', {
      kind: 'text',
      join: 'and',
      conditions: [{ op: 'equals', text: 'ETH' }],
    });
    const [filteredTotals] = model.pinnedBottom;
    expect(filteredTotals.kind === 'group' && filteredTotals.group.aggregates).toEqual({
      quantity: 11,
      id: 3,
    });
  });

  it('collapses and expands groups by path, keeping the defaults out of the state', () => {
    const model = table({ groupBy: ['symbol'], defaultExpanded: 'none' });
    expect(outline(model)).toEqual(['BTC (2)', 'ETH (3)']);
    model.grouping.toggle(['ETH']);
    expect(outline(model)).toEqual(['BTC (2)', 'ETH (3)', '  #1', '  #3', '  #5']);
    expect(model.state.extensions.grouping).toEqual({ groupBy: ['symbol'] });
    model.grouping.expandAll();
    expect(model.rows.rowCount).toBe(7);
    model.grouping.collapseAll();
    expect(model.rows.rowCount).toBe(2);
  });

  it('sorts leaves inside their groups and leaves the group order alone', () => {
    const model = table({ groupBy: ['symbol'] });
    model.sorting.set([{ columnId: 'quantity', direction: 'desc' }]);
    expect(outline(model)).toEqual(['BTC (2)', '  #4', '  #2', 'ETH (3)', '  #5', '  #3', '  #1']);
  });

  it('reveals a leaf by expanding the groups above it and refuses columns that cannot group', () => {
    const model = table({ groupBy: ['symbol', 'side'], defaultExpanded: 'none' });
    expect(model.grouping.reveal('3')).toBe(model.rows.indexOf('3'));
    expect(model.grouping.isExpanded(['ETH'])).toBe(true);
    expect(model.grouping.isExpanded(['ETH', 'sell'])).toBe(true);
    expect(model.grouping.isExpanded(['BTC'])).toBe(false);
    expect(model.grouping.addGroup('id')).toEqual({ ok: false, reason: 'grouping.notGroupable' });
  });
});
