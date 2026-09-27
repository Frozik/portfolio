import { fireEvent, render, screen, within } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import { gridView } from '../../../extensions/grid-view/core';
import type { TGroupDisplay } from '../../../extensions/grouping/core';
import { Table } from '../../Table';
import { grouping } from './grouping';

type TItem = { readonly id: number; readonly symbol: string; readonly quantity: number };

const items: TItem[] = [
  { id: 1, symbol: 'ETH', quantity: 2 },
  { id: 2, symbol: 'BTC', quantity: 1 },
  { id: 3, symbol: 'ETH', quantity: 4 },
];

const define = column<TItem>();

function harness(display: TGroupDisplay) {
  const model = createTable({
    columns: [
      define({ id: 'symbol', title: 'Symbol', kind: 'text', value: row => row.symbol }),
      define({
        id: 'quantity',
        title: 'Quantity',
        kind: 'number',
        value: row => row.quantity,
        aggregate: 'sum',
      }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [
      gridView(),
      grouping<TItem>({
        groupBy: ['symbol'],
        display,
        totals: { position: 'bottom', title: 'Total' },
      }),
    ],
    context: undefined,
  });
  render(<Table model={model} />);
  return model;
}

function bodyRows(): readonly HTMLElement[] {
  return screen.getAllByRole('row').filter(row => row.classList.contains('ft-body-row'));
}

describe('grouping in the grid', () => {
  it('renders full-width group rows with count and aggregates, and a totals row below the body', () => {
    harness('row');
    const rows = bodyRows();
    expect(rows[0].textContent).toContain('BTC (1)');
    expect(rows[0].textContent).toContain('Quantity: 1');
    expect(rows.at(-1)?.textContent).toContain('Total');
    expect(rows.at(-1)?.textContent).toContain('Quantity: 7');
  });

  it('collapses a group from its expander and from the keyboard on the focused group row', () => {
    const model = harness('column');
    const [btc] = bodyRows();

    fireEvent.click(within(btc).getByRole('button', { name: 'Collapse group' }));
    expect(model.grouping.isExpanded(['BTC'])).toBe(false);

    fireEvent.click(within(btc).getAllByRole('gridcell')[0]);
    fireEvent.keyDown(screen.getByRole('treegrid'), { key: 'ArrowRight' });
    expect(model.grouping.isExpanded(['BTC'])).toBe(true);
    expect(within(bodyRows()[0]).getAllByRole('gridcell')[1].textContent).toBe('1');
  });
});
