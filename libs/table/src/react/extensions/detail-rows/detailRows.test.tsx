import { fireEvent, render, screen, within } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import { gridView } from '../../../extensions/grid-view/core';
import type { IRowContext } from '../../column';
import { Table } from '../../Table';
import { detailRows } from './detailRows';

type TItem = { readonly id: number; readonly name: string };

const items: TItem[] = [
  { id: 1, name: 'cedar' },
  { id: 2, name: 'ash' },
];

const define = column<TItem>();

function Detail({ displayRow }: IRowContext<TItem>) {
  return <p>detail of {displayRow.kind === 'leaf' ? displayRow.row.name : '?'}</p>;
}

function harness() {
  const model = createTable({
    columns: [define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name })],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [
      gridView({ virtualizeColumns: false }),
      detailRows<TItem>({ detail: Detail, detailHeight: 120 }),
    ],
    context: undefined,
  });
  render(<Table model={model} />);
  return model;
}

describe('detail rows in the grid', () => {
  it('opens the detail under a row from its arrow and closes it from the keyboard', () => {
    const model = harness();
    const firstRow = screen.getAllByRole('row').find(row => row.classList.contains('ft-body-row'));
    const toggle = within(firstRow ?? document.body).getByRole('button', { name: 'Show details' });

    fireEvent.click(toggle);
    expect(screen.getByText('detail of cedar')).toBeDefined();
    expect(model.rowExtent('1')).toBe(120);

    fireEvent.click(within(firstRow ?? document.body).getAllByRole('gridcell')[1]);
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowLeft' });
    expect(model.focus.cell?.columnId).toBe('detail');
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowLeft' });
    expect(screen.queryByText('detail of cedar')).toBeNull();
  });

  it('opens the detail with a click on the row when expandOn is click', () => {
    harness();
    const rows = screen.getAllByRole('row').filter(row => row.classList.contains('ft-body-row'));
    fireEvent.click(within(rows[1]).getAllByRole('gridcell')[1]);
    expect(screen.getByText('detail of ash')).toBeDefined();
  });
});
