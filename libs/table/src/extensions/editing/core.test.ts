import { observable, runInAction } from 'mobx';

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
  change?: (changes: readonly IRowChange<TItem>[]) => void | Promise<void>
) {
  const items = observable.box<readonly TItem[]>([
    { id: 1, name: 'cedar', price: 30 },
    { id: 2, name: 'ash', price: 10, locked: true },
  ]);
  const changes: IRowChange<TItem>[] = [];
  const calls: number[] = [];
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
        editable: ({ row }) => row.locked !== true,
      }),
      define({
        id: 'price',
        title: 'Price',
        kind: 'number',
        value: row => row.price,
        set: (row, price) => ({ ...row, price }),
        editable: true,
      }),
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id }),
      define({
        id: 'silent',
        title: 'Silent',
        kind: 'number',
        value: row => row.price,
        set: (row, price) => ({ ...row, price }),
      }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items.get() }),
    extensions: [editing<TItem>(options)],
    context: undefined,
    onRowsChange: rowChanges => {
      changes.push(...rowChanges);
      calls.push(rowChanges.length);
      return change?.(rowChanges);
    },
  });
  const arrive = (next: TItem): void =>
    runInAction(() => items.set(items.get().map(item => (item.id === next.id ? next : item))));
  return { model, changes, calls, arrive };
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
    expect(changes[0].new.name).toBe('cedar tree');
    expect(changes[0].old.name).toBe('cedar');
    expect(changes[0].fields).toEqual(['name']);
    expect(model.editing.current).toBeNull();
  });

  it('refuses read-only cells: without set, without editable, locked by the column rule or by the table', () => {
    const { model } = harness();
    expect(model.editing.reasonAgainst('1', 'id')).toBe('editing.notEditable');
    expect(model.editing.reasonAgainst('1', 'silent')).toBe('editing.notEditable');
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

  it('takes a value a cell produced on its own, without a session, through the same rules', () => {
    const { model, changes } = harness();
    expect(model.editing.change({ rowKey: '1', columnId: 'name', value: 'oak' })).toEqual({
      ok: true,
    });
    expect(changes.map(change => change.new.name)).toEqual(['oak']);
    expect(model.editing.current).toBeNull();
    expect(model.editing.change({ rowKey: '1', columnId: 'name', value: '' })).toEqual({
      ok: false,
      reason: 'editing.invalid',
    });
    expect(model.editing.change({ rowKey: '2', columnId: 'name', value: 'elm' })).toEqual({
      ok: false,
      reason: 'editing.notEditable',
    });
    expect(model.editing.change({ rowKey: '1', columnId: 'price', value: 30 })).toEqual({
      ok: true,
    });
    expect(changes).toHaveLength(1);
  });

  it('keeps the edits of a row until it is confirmed, in confirm mode, and drops them on revert', () => {
    const { model, changes } = harness({ commitMode: 'confirm' });
    model.editing.begin({ rowKey: '1', columnId: 'name' });
    model.editing.update('oak');
    model.editing.commit();
    expect(changes).toHaveLength(0);
    expect(rowAt(model, 0)?.name).toBe('oak');
    expect(model.editing.isEdited('1', 'name')).toBe(true);
    expect(model.editing.pending).toEqual(['1']);
    model.editing.revert('1');
    expect(rowAt(model, 0)?.name).toBe('cedar');
    expect(model.editing.pending).toEqual([]);
  });

  it('confirms one row through its API and every pending row in one call, each with old, new and fields', () => {
    const { model, changes, calls } = harness({ commitMode: 'confirm' });
    model.editing.change({ rowKey: '1', columnId: 'name', value: 'oak' });
    model.editing.change({ rowKey: '1', columnId: 'price', value: 31 });
    model.editing.change({ rowKey: '2', columnId: 'price', value: 11 });
    model.editing.confirm('1');
    expect(calls).toEqual([1]);
    expect(changes[0]).toMatchObject({
      old: { name: 'cedar', price: 30 },
      new: { name: 'oak', price: 31 },
      rowKey: '1',
      fields: ['name', 'price'],
    });
    model.editing.change({ rowKey: '1', columnId: 'name', value: 'elm' });
    model.editing.confirmAll();
    expect(calls).toEqual([1, 2]);
    expect(changes.slice(1).map(change => change.rowKey)).toEqual(['2', '1']);
    expect(model.editing.pending).toEqual([]);
  });

  it('holds the row a session is on and its unconfirmed edit while a new version arrives, by default', () => {
    const { model, arrive } = harness({ commitMode: 'confirm' });
    model.editing.begin({ rowKey: '1', columnId: 'name' });
    arrive({ id: 1, name: 'cedar 2', price: 35 });
    expect(rowAt(model, 0)?.name).toBe('cedar');
    model.editing.update('oak');
    model.editing.commit();
    expect(rowAt(model, 0)).toMatchObject({ name: 'oak', price: 30 });
    model.editing.revert('1');
    expect(rowAt(model, 0)).toMatchObject({ name: 'cedar 2', price: 35 });
  });

  it('applies a new version at once and drops the edit on it, under the apply policy', () => {
    const { model, arrive } = harness({ commitMode: 'confirm', incoming: 'apply' });
    model.editing.change({ rowKey: '1', columnId: 'name', value: 'oak' });
    expect(model.editing.isEdited('1')).toBe(true);
    arrive({ id: 1, name: 'cedar 2', price: 35 });
    expect(rowAt(model, 0)).toMatchObject({ name: 'cedar 2', price: 35 });
    expect(model.editing.isEdited('1')).toBe(false);

    model.editing.begin({ rowKey: '1', columnId: 'name' });
    arrive({ id: 1, name: 'cedar 3', price: 36 });
    expect(model.editing.current).toBeNull();
    expect(rowAt(model, 0)?.name).toBe('cedar 3');
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
    expect(changes[0].new.price).toBe(10);
  });
});
