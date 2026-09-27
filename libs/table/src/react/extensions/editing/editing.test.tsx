import { fireEvent, render, screen, within } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import type { IRowChange } from '../../../core/rows/row-change';
import { gridView } from '../../../extensions/grid-view/core';
import { reactColumn } from '../../column';
import { Table } from '../../Table';
import { editing } from './editing';

type TItem = {
  readonly id: number;
  readonly name: string;
  readonly status: 'open' | 'done';
  readonly live: boolean;
};

const define = column<TItem>();
const defineReact = reactColumn<TItem>();

function harness() {
  const items: TItem[] = [
    { id: 1, name: 'cedar', status: 'open', live: false },
    { id: 2, name: 'ash', status: 'done', live: true },
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
      }),
      defineReact({
        id: 'status',
        title: 'Status',
        kind: 'text',
        value: row => row.status,
        set: (row, status) => ({ ...row, status }),
        editor: {
          kind: 'select',
          options: {
            values: [
              { value: 'open', label: 'Open' },
              { value: 'done', label: 'Done' },
            ],
          },
        },
      }),
      define({
        id: 'live',
        title: 'Live',
        kind: 'boolean',
        value: row => row.live,
        set: (row, live) => ({ ...row, live }),
      }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [gridView({ virtualizeColumns: false }), editing<TItem>()],
    context: undefined,
    onRowChange: change => void changes.push(change),
  });
  render(
    <Table
      model={model}
      cellSpec={context => (context.row.status === 'done' ? { editable: false } : undefined)}
    />
  );
  return { model, changes };
}

function cell(rowIndex: number, columnIndex: number): HTMLElement {
  const rows = screen.getAllByRole('row').filter(row => row.classList.contains('ft-body-row'));
  const cells = within(rows[rowIndex]).getAllByRole('gridcell');
  if (cells[columnIndex] === undefined) {
    throw new Error(`row ${rowIndex} has ${cells.length} cells: ${rows[rowIndex].innerHTML}`);
  }
  return cells[columnIndex];
}

describe('editing in the grid', () => {
  it('opens a text editor on Enter, commits on Enter and hands the row to the application', () => {
    const { model, changes } = harness();
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(cell(0, 0), { key: 'Enter' });
    expect(model.editing.current?.columnId).toBe('name');

    model.editing.update('oak');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(changes.map(change => change.next.name)).toEqual(['oak']);
    expect(model.editing.current).toBeNull();
  });

  it('marks editable cells, honours a cellSpec that locks a row, and toggles a checkbox with Space', () => {
    const { model, changes } = harness();
    expect(cell(0, 0).hasAttribute('data-editable')).toBe(true);
    expect(cell(1, 0).hasAttribute('data-editable')).toBe(false);

    fireEvent.click(cell(0, 2));
    fireEvent.keyDown(cell(0, 2), { key: ' ' });
    expect(changes[0]?.next.live).toBe(true);
    expect(model.editing.current).toBeNull();
  });

  it('picks from a select editor with the keyboard', () => {
    const { changes } = harness();
    fireEvent.doubleClick(cell(0, 1));
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(changes[0]?.next.status).toBe('done');
  });
});
