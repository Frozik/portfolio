import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import { gridView } from '../../../extensions/grid-view/core';
import { reactColumn } from '../../column';
import { Table } from '../../Table';
import { tooltips } from './tooltips';

type TItem = { readonly id: number; readonly name: string; readonly note: string };

const items: TItem[] = [{ id: 1, name: 'cedar', note: 'a very long note' }];

const define = column<TItem>();
const defineReact = reactColumn<TItem>();

function harness() {
  vi.useFakeTimers();
  const model = createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      defineReact({
        id: 'note',
        title: 'Note',
        kind: 'text',
        value: row => row.note,
        tooltip: context => ({ component: () => <b>{context.row.note.toUpperCase()}</b> }),
        headerTooltip: 'Free text',
      }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [gridView({ virtualizeColumns: false }), tooltips({ delayMs: 10 })],
    context: undefined,
  });
  render(<Table model={model} />);
  return model;
}

describe('tooltips in the grid', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a component tooltip after the delay and hides it when the pointer leaves', () => {
    harness();
    const row = screen
      .getAllByRole('row')
      .find(candidate => candidate.classList.contains('ft-body-row'));
    const noteCell = within(row ?? document.body).getAllByRole('gridcell')[1];

    fireEvent.mouseEnter(noteCell);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByRole('tooltip').textContent).toBe('A VERY LONG NOTE');

    fireEvent.mouseLeave(noteCell);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the header text tooltip and nothing for a plain cell that is not truncated', () => {
    harness();
    fireEvent.mouseEnter(screen.getAllByRole('columnheader')[1]);
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByRole('tooltip').textContent).toBe('Free text');
    fireEvent.mouseLeave(screen.getAllByRole('columnheader')[1]);

    const row = screen
      .getAllByRole('row')
      .find(candidate => candidate.classList.contains('ft-body-row'));
    fireEvent.mouseEnter(within(row ?? document.body).getAllByRole('gridcell')[0]);
    act(() => vi.advanceTimersByTime(20));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
