import { column } from './columns/column';
import { createTable } from './create-table';
import type { ITableExtension } from './kernel/extension';
import { clientRows } from './rows/client-rows';

type TItem = { readonly id: number; readonly label: string };

const items: TItem[] = [
  { id: 1, label: 'one' },
  { id: 2, label: 'two' },
];

const define = column<TItem>();

function counter(): ITableExtension<TItem, 'counter', { readonly hits: number; hit(): void }> {
  return {
    id: 'counter',
    create: () => {
      let hits = 0;
      return {
        slice: {
          get hits() {
            return hits;
          },
          hit: () => {
            hits += 1;
          },
        },
        columns: [
          define({ id: 'marker', title: '', kind: 'custom', value: () => undefined, width: 24 }),
        ],
        guards: {
          'columns.pin': ({ columnId }) => (columnId === 'label' ? 'app.keepLabel' : undefined),
        },
        dispose: () => undefined,
      };
    },
  };
}

function table() {
  return createTable({
    columns: [define({ id: 'label', title: 'Label', kind: 'text', value: row => row.label })],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [counter()],
    context: { tag: 'demo' },
  });
}

describe('createTable', () => {
  it('attaches every extension slice under its id, typed', () => {
    const model = table();
    model.counter.hit();
    expect(model.counter.hits).toBe(1);
    expect(model.extension<{ hits: number }>('counter')?.hits).toBe(1);
  });

  it('puts service columns from extensions first and never in the persisted state', () => {
    const model = table();
    expect(model.columns.visibleIds).toEqual(['marker', 'label']);
    expect(model.state.columns.map(state => state.id)).toEqual(['label']);
  });

  it('lets an extension guard a kernel command with a reason', () => {
    const model = table();
    expect(model.columns.pin('label', 'left')).toEqual({ ok: false, reason: 'app.keepLabel' });
  });

  it('exposes rows keyed by the row key field and the application context', () => {
    const model = table();
    expect(model.rows.keyAt(1)).toBe('2');
    expect(model.context.tag).toBe('demo');
  });

  it('refuses two extensions with one id', () => {
    expect(() =>
      createTable({
        columns: [],
        rowKey: 'id',
        rows: clientRows<TItem>({ rows: () => items }),
        extensions: [counter(), counter()],
        context: undefined,
      })
    ).toThrow('registered twice');
  });
});
