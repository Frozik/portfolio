import { assert } from '@frozik/utils/assert/assert';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';
import { observable, runInAction } from 'mobx';

import { column } from '../core/columns/column';
import { createTable } from '../core/create-table';
import { clientRows } from '../core/rows/client-rows';
import { editing } from '../extensions/editing/core';
import { filtering } from '../extensions/filtering/core';
import { sorting } from '../extensions/sorting/core';
import { defineTableTools } from './table-agent-tools';

type TItem = {
  readonly id: number;
  readonly name: string;
  readonly price: number;
  readonly locked?: boolean;
};

const define = column<TItem>();

function setup() {
  const items = observable.box<readonly TItem[]>([
    { id: 1, name: 'cedar', price: 30 },
    { id: 2, name: 'ash', price: 10, locked: true },
    { id: 3, name: 'birch', price: 20 },
  ]);
  const model = createTable({
    columns: [
      define({
        id: 'name',
        title: 'Name',
        kind: 'text',
        value: row => row.name,
        set: (row, name) => ({ ...row, name }),
        validate: name => (name.trim() === '' ? 'A name is required' : undefined),
        editable: ({ row }) => row.locked !== true,
        filter: true,
      }),
      define({
        id: 'price',
        title: 'Price',
        kind: 'number',
        value: row => row.price,
        set: (row, price) => ({ ...row, price }),
        editable: true,
        filter: true,
      }),
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id, sort: false }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items.get() }),
    extensions: [sorting<TItem>(), filtering<TItem>(), editing<TItem>()],
    context: undefined,
    onRowsChange: changes =>
      runInAction(() =>
        items.set(items.get().map(item => changes.find(change => change.old === item)?.new ?? item))
      ),
  });
  const tools = defineTableTools({
    prefix: 'items',
    table: model,
    reasons: { 'items.frozen': 'Birch is frozen' },
  });
  const call = (name: string, input: object = {}): Promise<unknown> => {
    const tool = tools.find((candidate: IAgentTool) => candidate.name === name);
    assert(!isNil(tool), `no ${name} tool`);
    return tool.run(input, new AbortController().signal);
  };
  return { model, tools, call };
}

describe('table agent tools', () => {
  it('offer only what the table has: no scrolling without a grid view', () => {
    const { tools } = setup();

    expect(tools.map(tool => tool.name)).not.toContain('items_scroll');
    expect(tools.map(tool => tool.name)).toContain('items_edit_cell');
  });

  it('describe the columns: kind, editability, sortability and filter kind', async () => {
    const { call } = setup();

    await expect(call('items_describe')).resolves.toMatchObject({
      rows: { count: 3, inView: null },
      columns: [
        { id: 'name', editable: 'some rows', sortable: true, filter: { kind: 'text' } },
        { id: 'price', editable: 'yes', sortable: true, filter: { kind: 'number' } },
        { id: 'id', editable: 'no', sortable: false, filter: null },
      ],
    });
  });

  it('read rows as the table shows them, after sorting', async () => {
    const { call } = setup();

    await call('items_sort', { column: 'price', direction: 'desc' });

    await expect(call('items_read_rows', { from: 0, count: 2 })).resolves.toEqual([
      { index: 0, key: '1', cells: { name: 'cedar', price: '30', id: '1' } },
      { index: 1, key: '3', cells: { name: 'birch', price: '20', id: '3' } },
    ]);
  });

  it('filter by a column model and refuse a model of the wrong kind', async () => {
    const { call } = setup();

    await expect(
      call('items_set_filter', {
        column: 'price',
        filter: { kind: 'number', conditions: [{ op: 'greaterThan', from: 15 }] },
      })
    ).resolves.toMatchObject({ rows: 2 });
    await expect(
      call('items_set_filter', { column: 'price', filter: { kind: 'set', values: ['10'] } })
    ).resolves.toEqual({ error: expect.stringMatching(/takes a number filter/) });
  });

  it('search every text column like the quick search box', async () => {
    const { call } = setup();

    await expect(call('items_search', { text: 'ash' })).resolves.toEqual({ rows: 1 });
    await expect(call('items_clear_filters')).resolves.toEqual({ rows: 3 });
  });

  it('edit a cell through the editing slice, reading the value by the column kind', async () => {
    const { call } = setup();

    await expect(
      call('items_edit_cell', { key: '1', column: 'price', value: '42' })
    ).resolves.toMatchObject({
      row: { key: '1', cells: { price: '42' } },
      awaitsConfirmation: false,
    });
  });

  it('refuse an edit the UI would refuse, saying why in words', async () => {
    const { model, call } = setup();
    model.commands.guard('editing.begin', ({ rowKey }) =>
      rowKey === '3' ? 'items.frozen' : undefined
    );

    await expect(
      call('items_edit_cell', { key: '1', column: 'name', value: '  ' })
    ).resolves.toEqual({ error: 'A name is required' });
    await expect(
      call('items_edit_cell', { key: '2', column: 'name', value: 'oak' })
    ).resolves.toEqual({ error: 'This cell is not editable' });
    await expect(
      call('items_edit_cell', { key: '3', column: 'name', value: 'oak' })
    ).resolves.toEqual({ error: 'Birch is frozen' });
    await expect(
      call('items_edit_cell', { key: '1', column: 'price', value: 'cheap' })
    ).resolves.toEqual({ error: '"cheap" is not a number.' });
  });

  it('hold edits for confirmation in confirm mode until they are settled', async () => {
    const { model, call } = setup();
    model.editing.setCommitMode('confirm');

    await expect(
      call('items_edit_cell', { key: '1', column: 'price', value: 5 })
    ).resolves.toMatchObject({ awaitsConfirmation: true });
    await expect(call('items_settle_edits', { action: 'confirm' })).resolves.toEqual({
      unconfirmedRows: [],
    });
  });
});
