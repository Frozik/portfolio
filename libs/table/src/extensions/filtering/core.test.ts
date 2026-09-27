import { Temporal } from 'temporal-polyfill';

import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import type { IFilterChange } from './contracts';
import { filtering } from './core';
import { dateFilter } from './specs/date';
import { enumFilter } from './specs/enum';
import { setFilter } from './specs/set';
import { textFilter } from './specs/text';

type TItem = {
  readonly id: number;
  readonly name: string;
  readonly price: number | null;
  readonly time: string;
  readonly venue: string;
  readonly side: 'buy' | 'sell';
  readonly live: boolean;
};

const items: TItem[] = [
  {
    id: 1,
    name: 'Cedar plank',
    price: 30,
    time: '2026-09-27T10:00:00Z',
    venue: 'A',
    side: 'buy',
    live: true,
  },
  {
    id: 2,
    name: 'ash',
    price: null,
    time: '2026-09-26T23:30:00Z',
    venue: 'B',
    side: 'sell',
    live: false,
  },
  {
    id: 3,
    name: 'Birch, fine',
    price: 20,
    time: '2026-09-20T12:00:00Z',
    venue: 'A',
    side: 'buy',
    live: true,
  },
  {
    id: 4,
    name: 'oak',
    price: 45,
    time: '2026-08-30T12:00:00Z',
    venue: '',
    side: 'sell',
    live: false,
  },
];

const NOW = Temporal.Instant.from('2026-09-27T15:00:00Z');
const define = column<TItem>();

function table(onFilterChange?: (change: IFilterChange) => void) {
  return createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name, filter: true }),
      define({
        id: 'price',
        title: 'Price',
        kind: 'number',
        value: row => row.price,
        filter: true,
      }),
      define({
        id: 'time',
        title: 'Time',
        kind: 'datetime',
        value: row => row.time,
        filter: dateFilter({ timeZone: 'UTC', now: () => NOW }),
      }),
      define({
        id: 'venue',
        title: 'Venue',
        kind: 'text',
        value: row => row.venue,
        filter: setFilter({ values: 'accumulate', extraOption: { key: '-', label: 'none' } }),
      }),
      define({
        id: 'side',
        title: 'Side',
        kind: 'text',
        value: row => row.side,
        filter: enumFilter({
          options: [
            { key: 'buy', label: 'Buy' },
            { key: 'sell', label: 'Sell' },
          ],
        }),
      }),
      define({ id: 'live', title: 'Live', kind: 'boolean', value: row => row.live, filter: true }),
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [filtering({ onFilterChange })],
    context: undefined,
  });
}

function ids(model: ReturnType<typeof table>): readonly number[] {
  return Array.from({ length: model.rows.rowCount ?? 0 }, (_, index) => {
    const row = model.rows.rowAt(index);
    return row.kind === 'leaf' ? row.row.id : -1;
  });
}

describe('filtering', () => {
  it('filters text case-insensitively, joins up to two conditions and drops empty models', () => {
    const model = table();
    model.filtering.set('name', {
      kind: 'text',
      join: 'or',
      conditions: [
        { op: 'startsWith', text: 'ce' },
        { op: 'contains', text: 'fine' },
      ],
    });
    expect(ids(model)).toEqual([1, 3]);
    model.filtering.set('name', {
      kind: 'text',
      join: 'and',
      conditions: [{ op: 'contains', text: '  ' }],
    });
    expect(model.filtering.filters).toEqual({});
    expect(ids(model)).toEqual([1, 2, 3, 4]);
  });

  it('lets empty values through only the operators that accept them', () => {
    const model = table();
    model.filtering.set('price', {
      kind: 'number',
      join: 'and',
      conditions: [{ op: 'greaterThan', from: 10 }],
    });
    expect(ids(model)).toEqual([1, 3, 4]);
    model.filtering.set('price', {
      kind: 'number',
      join: 'and',
      conditions: [{ op: 'notEquals', from: 30 }],
    });
    expect(ids(model)).toEqual([2, 3, 4]);
    model.filtering.set('price', { kind: 'number', join: 'and', conditions: [{ op: 'blank' }] });
    expect(ids(model)).toEqual([2]);
  });

  it('understands calendar days in the column time zone and relative windows from now', () => {
    const model = table();
    model.filtering.set('time', {
      kind: 'date',
      join: 'and',
      conditions: [{ op: 'equals', from: '2026-09-26' }],
    });
    expect(ids(model)).toEqual([2]);
    model.filtering.set('time', { kind: 'date', join: 'and', conditions: [{ op: 'last7Days' }] });
    expect(ids(model)).toEqual([1, 2]);
    model.filtering.set('time', { kind: 'date', join: 'and', conditions: [{ op: 'lastMonth' }] });
    expect(ids(model)).toEqual([4]);
    model.filtering.set('time', {
      kind: 'date',
      join: 'and',
      conditions: [{ op: 'equals', from: '2026-09-27T10:00' }],
    });
    expect(ids(model)).toEqual([1]);
    model.filtering.set('time', {
      kind: 'date',
      join: 'and',
      conditions: [{ op: 'between', from: '2026-09-26T23:00', to: '2026-09-27T10:00' }],
    });
    expect(ids(model)).toEqual([1, 2]);
  });

  it('accumulates the values a set filter has seen and keeps the rows whose key was chosen', () => {
    const model = table();
    expect(model.filtering.valuesSeen('venue')).toEqual(['A', 'B', '']);
    model.filtering.set('venue', { kind: 'set', values: ['B', '-'] });
    expect(ids(model)).toEqual([2]);
  });

  it('filters by enum and boolean values and counts the active filters with the quick filter', () => {
    const model = table();
    model.filtering.set('side', { kind: 'enum', value: 'buy' });
    model.filtering.set('live', { kind: 'boolean', value: true });
    model.filtering.setQuick({ text: 'birch fine' });
    expect(ids(model)).toEqual([3]);
    expect(model.filtering.activeCount).toBe(3);
    model.filtering.clear();
    expect(ids(model)).toEqual([1, 2, 3, 4]);
  });

  it('reports an invalid quick regexp and lets every row through meanwhile', () => {
    const model = table();
    model.filtering.setQuick({ text: '(', mode: 'regexp' });
    expect(model.filtering.quickInvalid).toBe(true);
    expect(ids(model)).toEqual([1, 2, 3, 4]);
    model.filtering.setQuick({ text: '(ash|oak)' });
    expect(ids(model)).toEqual([2, 4]);
  });

  it('refuses columns without a filter, tells the application about changes and builds equals-models', () => {
    const changes: IFilterChange[] = [];
    const model = table(change => changes.push(change));
    expect(model.filtering.set('id', { kind: 'number', join: 'and', conditions: [] })).toEqual({
      ok: false,
      reason: 'filtering.notFilterable',
    });
    const equalsAsh = model.filtering.filterFor('name', 'ash');
    expect(equalsAsh).toEqual({
      kind: 'text',
      join: 'and',
      conditions: [{ op: 'equals', text: 'ash' }],
    });
    model.filtering.set('name', equalsAsh ?? null);
    expect(ids(model)).toEqual([2]);
    expect(changes).toHaveLength(1);
    expect(changes[0].previous).toBeUndefined();
    expect(model.state.extensions.filtering).toMatchObject({ filters: { name: equalsAsh } });
  });

  it('accepts application operators with their own predicates', () => {
    const model = createTable({
      columns: [
        define({
          id: 'name',
          title: 'Name',
          kind: 'text',
          value: row => row.name,
          filter: textFilter({
            operators: [
              'contains',
              {
                id: 'shorterThan',
                label: 'shorter than',
                predicate: (condition, value) => String(value).length < Number(condition.text),
              },
            ],
          }),
        }),
      ],
      rowKey: 'id',
      rows: clientRows({ rows: () => items }),
      extensions: [filtering()],
      context: undefined,
    });
    model.filtering.set('name', {
      kind: 'text',
      join: 'and',
      conditions: [{ op: 'shorterThan', text: '4' }],
    });
    expect(ids(model)).toEqual([2, 4]);
  });
});
