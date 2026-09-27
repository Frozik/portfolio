import { fireEvent, render, screen, within } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import { gridView } from '../../../extensions/grid-view/core';
import { Table } from '../../Table';
import { sorting } from '../sorting/sorting';
import { contextMenu } from './contextMenu';

type TItem = { readonly id: number; readonly name: string };

const items: TItem[] = [
  { id: 1, name: 'cedar' },
  { id: 2, name: 'ash' },
];

const define = column<TItem>();

function harness() {
  const opened: string[] = [];
  const model = createTable({
    columns: [define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name })],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [
      gridView(),
      sorting(),
      contextMenu<TItem>({
        items: context => [
          { id: 'app.open', label: 'Open', run: () => void opened.push(context.rowKey ?? '') },
        ],
      }),
    ],
    context: undefined,
  });
  render(<Table model={model} />);
  return { model, opened };
}

describe('context menu in the grid', () => {
  it('opens on right click with translated built-in items and runs an application item', () => {
    const { opened } = harness();
    const header = screen.getAllByRole('columnheader')[0];

    fireEvent.contextMenu(header);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Sort ascending')).toBeDefined();

    fireEvent.click(within(menu).getByText('Open'));
    expect(opened).toEqual(['']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens from the keyboard on the focused cell and walks the items with arrows', () => {
    const { model, opened } = harness();
    const rows = screen.getAllByRole('row').filter(row => row.classList.contains('ft-body-row'));
    fireEvent.click(within(rows[1]).getAllByRole('gridcell')[0]);
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'F10', shiftKey: true });

    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(opened).toEqual(['2']);
    expect(model.contextMenu.open).toBeNull();
  });
});
