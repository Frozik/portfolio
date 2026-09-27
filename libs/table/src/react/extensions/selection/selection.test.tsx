import { fireEvent, render, screen, within } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import { gridView } from '../../../extensions/grid-view/core';
import type { ISelectionOptions } from '../../../extensions/selection/contracts';
import { Table } from '../../Table';
import { clipboard } from '../clipboard/clipboard';
import { selection } from './selection';

type TItem = { readonly id: number; readonly name: string; readonly price: number };

const items: TItem[] = [
  { id: 1, name: 'cedar', price: 30 },
  { id: 2, name: 'ash', price: 10 },
  { id: 3, name: 'birch', price: 20 },
];

const define = column<TItem>();

function harness(options: ISelectionOptions<TItem>) {
  const written: string[] = [];
  const model = createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({ id: 'price', title: 'Price', kind: 'number', value: row => row.price }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [
      gridView(),
      selection<TItem>(options),
      clipboard({ port: { write: text => void written.push(text) } }),
    ],
    context: undefined,
  });
  render(<Table model={model} />);
  return { model, written };
}

function bodyRow(index: number): HTMLElement {
  return screen.getAllByRole('row')[index + 1];
}

function cell(rowIndex: number, columnIndex: number): HTMLElement {
  return within(bodyRow(rowIndex)).getAllByRole('gridcell')[columnIndex];
}

describe('selection in the grid', () => {
  it('selects a row on click, extends with Shift and marks every cell of a selected row', () => {
    const { model } = harness({ rows: 'multiple' });

    fireEvent.click(cell(0, 0));
    fireEvent.click(cell(2, 1), { shiftKey: true });

    expect(model.selection.count).toBe(3);
    expect(cell(1, 0).hasAttribute('data-selected')).toBe(true);
    expect(cell(1, 1).hasAttribute('data-selected')).toBe(true);
  });

  it('offers a checkbox column whose header selects everything and shows the mixed state', () => {
    const { model } = harness({ rows: 'multiple', checkboxes: true });
    const header = within(screen.getAllByRole('columnheader')[0]).getByRole('checkbox');

    fireEvent.click(header);
    expect(model.selection.count).toBe(3);
    expect(header.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(within(cell(1, 0)).getByRole('checkbox'));
    expect(header.getAttribute('aria-checked')).toBe('mixed');
    expect(model.selection.isSelected('2')).toBe(false);
  });

  it('toggles the focused row with Space and copies the selection with the command key', () => {
    const { model, written } = harness({ rows: 'multiple' });
    const grid = screen.getByRole('grid');

    fireEvent.click(cell(1, 0));
    fireEvent.click(cell(1, 0), { metaKey: true });
    fireEvent.keyDown(grid, { key: ' ' });
    fireEvent.keyDown(grid, { key: 'c', metaKey: true });

    expect(model.selection.isSelected('2')).toBe(true);
    expect(written).toEqual(['ash\t10']);
  });

  it('drags a block of cells and outlines its edges', () => {
    harness({ cells: true });

    fireEvent.mouseDown(cell(0, 0), { button: 0 });
    fireEvent.mouseEnter(cell(1, 1));
    fireEvent.mouseUp(window);

    expect(cell(0, 0).getAttribute('data-range-edge')).toBe('top left');
    expect(cell(1, 1).getAttribute('data-range-edge')).toBe('right bottom');
    expect(cell(2, 0).hasAttribute('data-in-range')).toBe(false);
  });
});
