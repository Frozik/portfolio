import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import type { IRowChange } from '../../../core/rows/row-change';
import { gridView } from '../../../extensions/grid-view/core';
import { selectCell } from '../../cells/selectCell';
import type { ICellProps } from '../../column';
import { reactColumn } from '../../column';
import { Table } from '../../Table';
import { editing } from './editing';

type TItem = {
  readonly id: number;
  readonly name: string;
  readonly status: 'open' | 'done';
  readonly live: boolean;
  readonly tag: string;
};

const define = column<TItem>();
const defineReact = reactColumn<TItem>();

/** A cell that decides its mode itself: text, a field after a double click, the value handed over on Enter. */
const SelfEditingCell = observer(function SelfEditingCell({
  text,
  value,
  mode,
  editable,
  edit,
}: ICellProps<TItem, string>) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  if (draft === undefined) {
    return (
      <span data-mode={mode ?? 'own'} onDoubleClick={() => editable && setDraft(value)}>
        {text}
      </span>
    );
  }
  return (
    <input
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter' && edit.change(draft)) {
          setDraft(undefined);
        }
      }}
    />
  );
});

const NameView = ({ text }: { readonly text: string }) => (
  <span data-testid="name-view">{text}</span>
);

function harness(commitMode: 'immediate' | 'confirm' = 'immediate') {
  const items: TItem[] = [
    { id: 1, name: 'cedar', status: 'open', live: false, tag: 'wood' },
    { id: 2, name: 'ash', status: 'done', live: true, tag: 'ash' },
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
        editable: true,
      }),
      defineReact({
        id: 'status',
        title: 'Status',
        kind: 'text',
        value: row => row.status,
        set: (row, status) => ({ ...row, status }),
        editable: true,
        cell: selectCell({
          values: [
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
          ],
        }),
      }),
      define({
        id: 'live',
        title: 'Live',
        kind: 'boolean',
        value: row => row.live,
        set: (row, live) => ({ ...row, live }),
        editable: true,
      }),
      defineReact({
        id: 'tag',
        title: 'Tag',
        kind: 'text',
        value: row => row.tag,
        set: (row, tag) => ({ ...row, tag }),
        editable: true,
        interactive: true,
        cell: SelfEditingCell,
      }),
      defineReact({
        id: 'view',
        title: 'View',
        kind: 'text',
        value: row => row.name,
        cell: NameView,
      }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [gridView({ virtualizeColumns: false }), editing<TItem>({ commitMode })],
    context: undefined,
    onRowsChange: rowChanges => void changes.push(...rowChanges),
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
  it('puts the cell into edit mode on Enter, commits on Enter and hands the change to the application', () => {
    const { model, changes } = harness();
    expect(cell(0, 0).textContent).toBe('cedar');
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(cell(0, 0), { key: 'Enter' });
    expect(model.editing.current?.columnId).toBe('name');
    expect(cell(0, 0).hasAttribute('data-editing')).toBe(true);
    const field = within(cell(0, 0)).getByRole('textbox');

    act(() => model.editing.update('oak'));
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(changes).toEqual([
      expect.objectContaining({
        rowKey: '1',
        fields: ['name'],
        new: expect.objectContaining({ name: 'oak' }),
      }),
    ]);
    expect(model.editing.current).toBeNull();
    expect(cell(0, 0).hasAttribute('data-editing')).toBe(false);
    expect(within(cell(0, 0)).queryByRole('textbox')).toBeNull();
  });

  it('marks editable cells from the column rule and the cellSpec, and flips a boolean without a session', () => {
    const { model, changes } = harness();
    expect(cell(0, 0).hasAttribute('data-editable')).toBe(true);
    expect(cell(1, 0).hasAttribute('data-editable')).toBe(false);
    expect(cell(0, 4).hasAttribute('data-editable')).toBe(false);

    fireEvent.click(cell(0, 2));
    fireEvent.keyDown(cell(0, 2), { key: ' ' });
    expect(changes[0]?.new.live).toBe(true);
    expect(model.editing.current).toBeNull();
    fireEvent.click(within(cell(0, 2)).getByText('–'));
    expect(changes[1]?.new.live).toBe(true);
  });

  it('suppresses the text selection of a double click on an editable cell, so the popup opens unselected', () => {
    harness();
    const secondPress = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    cell(0, 1).dispatchEvent(secondPress);
    expect(secondPress.defaultPrevented).toBe(true);
    const singlePress = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 });
    cell(0, 1).dispatchEvent(singlePress);
    expect(singlePress.defaultPrevented).toBe(false);
    const lockedPress = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    cell(1, 0).dispatchEvent(lockedPress);
    expect(lockedPress.defaultPrevented).toBe(false);
  });

  it('keeps the view and opens a list under the cell for a select, picked with the keyboard', () => {
    const { changes } = harness();
    fireEvent.doubleClick(cell(0, 1));
    expect(cell(0, 1).childNodes[0]?.textContent).toBe('Open');
    const list = within(cell(0, 1)).getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(changes[0]?.new.status).toBe('done');
  });

  it('leaves the mode to a cell of an interactive column, which only reports the value', () => {
    const { model, changes } = harness();
    expect(cell(0, 3).querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('own');
    expect(cell(0, 0).querySelector('[data-mode]')).toBeNull();
    fireEvent.doubleClick(within(cell(0, 3)).getByText('wood'));
    expect(model.editing.current).toBeNull();
    const field = within(cell(0, 3)).getByRole('textbox');
    fireEvent.change(field, { target: { value: 'timber' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(changes.map(change => change.new.tag)).toEqual(['timber']);

    fireEvent.doubleClick(within(cell(1, 3)).getByText('ash'));
    expect(within(cell(1, 3)).queryByRole('textbox')).toBeNull();
  });

  it('waits for the row to be confirmed through the row API in confirm mode', () => {
    const { model, changes } = harness('confirm');
    fireEvent.doubleClick(cell(0, 0));
    act(() => model.editing.update('oak'));
    fireEvent.keyDown(within(cell(0, 0)).getByRole('textbox'), { key: 'Enter' });
    expect(changes).toEqual([]);
    expect(cell(0, 0).hasAttribute('data-edited')).toBe(true);
    expect(cell(0, 0).textContent).toBe('oak');

    act(() => model.editing.confirm('1'));
    expect(changes.map(change => change.new.name)).toEqual(['oak']);
    expect(cell(0, 0).hasAttribute('data-edited')).toBe(false);
  });
});
