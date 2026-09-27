import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import type { IRowChange } from '../../core/rows/row-change';
import type { IEditingOptions } from './contracts';
import { editing } from './core';

type TItem = {
  readonly id: number;
  readonly name: string;
  readonly price: number;
  readonly locked?: boolean;
};

const define = column<TItem>();

function harness(
  options: IEditingOptions<TItem> = {},
  change?: (change: IRowChange<TItem>) => void | Promise<void>
) {
  let items: TItem[] = [
    { id: 1, name: 'cedar', price: 30 },
    { id: 2, name: 'ash', price: 10, locked: true },
  ];
  const changes: IRowChange<TItem>[] = [];
  const model = createTable({
    columns: [
      define({
        id: 'name',
        title: 'Name',
        kind: 'text',
        value: row => row.name,
        set: (row, name) => ({ ...row, name }),
        validate: name =>
          name.trim() === ''
            ? 'Required'
            : name.length > 8
              ? { level: 'warning', message: 'Long' }
              : undefined,
        editable: row => row.locked !== true,
      }),
      define({
        id: 'price',
        title: 'Price',
        kind: 'number',
        value: row => row.price,
        set: (row, price) => ({ ...row, price }),
      }),
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [editing<TItem>(options)],
    context: undefined,
    onRowChange: rowChange => {
      changes.push(rowChange);
      return change?.(rowChange);
    },
  });
  const apply = (next: TItem): void => {
    items = items.map(item => (item.id === next.id ? next : item));
    model.rows.refresh();
  };
  return { model, changes, apply, rows: () => items };
}

function rowAt(model: ReturnType<typeof harness>['model'], index: number): TItem | undefined {
  const row = model.rows.rowAt(index);
  return row.kind === 'leaf' ? row.row : undefined;
}

describe('editing', () => {
  it('opens a session with the current value, validates the draft and hands the new row to the application', () => {
    const { model, changes } = harness();
    expect(model.editing.begin({ rowKey: '1', columnId: 'name' })).toEqual({ ok: true });
    expect(model.editing.current?.draft).toBe('cedar');
    model.editing.update('');
    expect(model.editing.current?.validation).toEqual({ level: 'error', message: 'Required' });
    expect(model.editing.commit()).toBe(false);
    model.editing.update('cedar tree');
    expect(model.editing.current?.validation?.level).toBe('warning');
    expect(model.editing.commit()).toBe(true);
    expect(changes).toHaveLength(1);
    expect(changes[0].next.name).toBe('cedar tree');
    expect(changes[0].row.name).toBe('cedar');
    expect(model.editing.current).toBeNull();
  });

  it('refuses read-only cells: without set, locked by the column rule or by the table', () => {
    const { model } = harness();
    expect(model.editing.reasonAgainst('1', 'id')).toBe('editing.notEditable');
    expect(model.editing.reasonAgainst('2', 'name')).toBe('editing.notEditable');
    expect(model.editing.reasonAgainst('1', 'price')).toBeUndefined();
    expect(harness({ readOnly: true }).model.editing.reasonAgainst('1', 'price')).toBe(
      'editing.readOnly'
    );
  });

  it('closes without an event when the draft equals the value, and drops the draft on cancel', () => {
    const { model, changes } = harness();
    model.editing.begin({ rowKey: '1', columnId: 'price' });
    model.editing.update(30);
    expect(model.editing.commit()).toBe(true);
    expect(changes).toHaveLength(0);
    model.editing.begin({ rowKey: '1', columnId: 'price' });
    model.editing.update(99);
    model.editing.cancel();
    expect(changes).toHaveLength(0);
    expect(model.editing.isEdited('1')).toBe(false);
  });

  it('shows the draft over the live row until the application settles it, in draft mode', () => {
    const { model, changes } = harness({ commitMode: 'draft' });
    model.editing.begin({ rowKey: '1', columnId: 'name' });
    model.editing.update('oak');
    model.editing.commit();
    expect(changes).toHaveLength(0);
    expect(rowAt(model, 0)?.name).toBe('oak');
    expect(model.editing.isEdited('1', 'name')).toBe(true);
    expect(model.editing.pending).toEqual(['1']);
    model.editing.discard('1');
    expect(rowAt(model, 0)?.name).toBe('cedar');
  });

  it('marks the row as updating while the application promise runs and rolls back when it rejects', async () => {
    let reject: (error: Error) => void = () => undefined;
    const { model } = harness(
      {},
      () => new Promise<void>((_, rejectPromise) => (reject = rejectPromise))
    );
    model.editing.begin({ rowKey: '1', columnId: 'price' });
    model.editing.update(40);
    model.editing.commit();
    expect(model.editing.updating.has('1')).toBe(true);
    expect(rowAt(model, 0)?.price).toBe(40);
    expect(model.editing.reasonAgainst('1', 'price')).toBe('editing.updating');

    reject(new Error('offline'));
    await vi.waitFor(() => expect(model.editing.updating.has('1')).toBe(false));
    expect(rowAt(model, 0)?.price).toBe(30);
    expect(model.editing.failures.get('1')).toBeInstanceOf(Error);
  });

  it('lets a cell bring its own accessors, for a cellSpec that narrows the column', () => {
    const { model, changes } = harness();
    model.editing.begin({
      rowKey: '1',
      columnId: 'price',
      accessors: { set: (row, value) => ({ ...row, price: Number(value) * 2 }) },
    });
    model.editing.update(5);
    model.editing.commit();
    expect(changes[0].next.price).toBe(10);
  });
});
