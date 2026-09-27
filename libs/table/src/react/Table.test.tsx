import { fireEvent, render, screen, within } from '@testing-library/react';

import { column } from '../core/columns/column';
import { createTable } from '../core/create-table';
import { clientRows } from '../core/rows/client-rows';
import { gridView } from '../extensions/grid-view/core';
import type { ICellContext } from './column';
import { reactColumn } from './column';
import { sorting } from './extensions/sorting/sorting';
import { Table } from './Table';

type TItem = { readonly id: number; readonly name: string; readonly price: number };

const items: TItem[] = [
  { id: 1, name: 'cedar', price: 30 },
  { id: 2, name: 'ash', price: 10 },
  { id: 3, name: 'birch', price: 20 },
];

const define = column<TItem>();

function model() {
  return createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({ id: 'price', title: 'Price', kind: 'number', value: row => row.price }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [gridView(), sorting()],
    context: undefined,
  });
}

function renderedNames(): readonly string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('gridcell')[0].textContent ?? '');
}

describe('<Table>', () => {
  it('renders a plain cell component and a per-cell resolver alike', () => {
    const Loud = ({ text }: { readonly text: string }) => <b>{text.toUpperCase()}</b>;
    const table = createTable({
      columns: [
        reactColumn<TItem>()({
          id: 'name',
          title: 'Name',
          kind: 'text',
          value: row => row.name,
          cell: Loud,
        }),
        reactColumn<TItem>()({
          id: 'price',
          title: 'Price',
          kind: 'number',
          value: row => row.price,
          cell: (context: ICellContext<TItem, number>) =>
            context.value > 15 ? Loud : ({ text }) => <i>{text}</i>,
        }),
      ],
      rowKey: 'id',
      rows: clientRows({ rows: () => items }),
      extensions: [gridView({ virtualizeColumns: false })],
      context: undefined,
    });
    render(<Table model={table} />);
    const [first, second] = screen.getAllByRole('row').slice(1);
    expect(within(first).getAllByRole('gridcell')[0].innerHTML).toBe('<b>CEDAR</b>');
    expect(within(first).getAllByRole('gridcell')[1].innerHTML).toBe('<b>30</b>');
    expect(within(second).getAllByRole('gridcell')[1].innerHTML).toBe('<i>10</i>');
  });

  it('renders the column titles and every row, keyed by the row key', () => {
    render(<Table model={model()} />);

    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual([
      expect.stringContaining('Name'),
      expect.stringContaining('Price'),
    ]);
    expect(renderedNames()).toEqual(['cedar', 'ash', 'birch']);
  });

  it('sorts by a column when its header is clicked and reports it to assistive technology', () => {
    render(<Table model={model()} />);
    const header = screen.getAllByRole('columnheader')[0];

    fireEvent.click(header);

    expect(renderedNames()).toEqual(['ash', 'birch', 'cedar']);
    expect(header.getAttribute('aria-sort')).toBe('ascending');
  });

  it('moves the focus with the arrow keys from the cell that was clicked', () => {
    const table = model();
    render(<Table model={table} />);
    const firstCell = within(screen.getAllByRole('row')[1]).getAllByRole('gridcell')[0];

    fireEvent.click(firstCell);
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowRight' });

    expect(table.focus.cell).toEqual({ rowKey: '2', columnId: 'price' });
  });

  it('shows the empty state when there are no rows', () => {
    const empty = createTable({
      columns: [define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name })],
      rowKey: 'id',
      rows: clientRows<TItem>({ rows: () => [] }),
      extensions: [gridView()],
      context: undefined,
    });
    render(<Table model={empty} emptyState="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});
