import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import { setFilter } from '../../../extensions/filtering/specs/set';
import { gridView } from '../../../extensions/grid-view/core';
import { Table } from '../../Table';
import { filtering } from './filtering';
import { QuickFilter } from './QuickFilter';

type TItem = {
  readonly id: number;
  readonly name: string;
  readonly venue: string;
  readonly price: number;
};

const items: TItem[] = [
  { id: 1, name: 'cedar', venue: 'A', price: 30 },
  { id: 2, name: 'ash', venue: 'B', price: 10 },
  { id: 3, name: 'birch', venue: 'A', price: 20 },
];

const define = column<TItem>();

function harness(filterRow: boolean) {
  const model = createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name, filter: true }),
      define({
        id: 'venue',
        title: 'Venue',
        kind: 'text',
        value: row => row.venue,
        filter: setFilter({ values: ['A', 'B'] }),
      }),
      define({
        id: 'price',
        title: 'Price',
        kind: 'number',
        value: row => row.price,
        filter: true,
      }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [gridView(), filtering({ filterRow, debounceMs: 0 })],
    context: undefined,
  });
  render(
    <>
      <QuickFilter model={model} debounceMs={0} />
      <Table model={model} />
    </>
  );
  return model;
}

function renderedNames(): readonly string[] {
  return screen
    .getAllByRole('row')
    .filter(row => row.classList.contains('ft-body-row'))
    .map(row => within(row).getAllByRole('gridcell')[0].textContent ?? '');
}

describe('filtering in the grid', () => {
  it('filters as the user types into the filter row field, after the debounce', async () => {
    const model = harness(true);
    const [nameField] = screen.getAllByRole('searchbox', { name: 'Filter' });

    fireEvent.change(nameField, { target: { value: 'b' } });
    await waitFor(() => expect(model.filtering.activeCount).toBe(1));

    expect(renderedNames()).toEqual(['birch']);
  });

  it('opens the editor from the header button and applies a set choice from it', () => {
    const model = harness(false);
    const venueHeader = screen.getAllByRole('columnheader')[1];

    fireEvent.click(within(venueHeader).getByRole('button', { name: 'Filter' }));
    const dialog = screen.getByRole('dialog', { name: 'Filter' });
    fireEvent.click(within(dialog).getByLabelText('B'));

    expect(model.filtering.filters.venue).toEqual({ kind: 'set', values: ['B'] });
    expect(renderedNames()).toEqual(['ash']);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('searches every text column from the quick filter box and offers a reset in the toolbar', async () => {
    const model = harness(false);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'ash' },
    });
    await waitFor(() => expect(renderedNames()).toEqual(['ash']));

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(model.filtering.activeCount).toBe(0);
    expect(renderedNames()).toEqual(['cedar', 'ash', 'birch']);
  });
});
