import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { selection } from '../selection/core';
import type { IClipboardPort } from './core';
import { clipboard } from './core';

type TItem = { readonly id: number; readonly name: string; readonly price: number };

const items: TItem[] = [
  { id: 1, name: 'cedar', price: 30 },
  { id: 2, name: 'ash', price: 10 },
  { id: 3, name: 'birch', price: 20 },
];

const define = column<TItem>();

function harness(mode: { readonly rows?: 'multiple'; readonly cells?: boolean }) {
  const written: string[] = [];
  const port: IClipboardPort = { write: text => void written.push(text) };
  const model = createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({ id: 'price', title: 'Price', kind: 'number', value: row => row.price }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [selection<TItem>({ ...mode, checkboxes: true }), clipboard({ port })],
    context: undefined,
  });
  return { model, written };
}

describe('clipboard', () => {
  it('copies the focused cell as plain text when nothing is selected', () => {
    const { model, written } = harness({});
    model.focus.focusCell('2', 'price');
    expect(model.clipboard.copy()).toEqual({ ok: true });
    expect(written).toEqual(['10']);
  });

  it('copies the selected rows as TSV over the visible columns, the checkbox column left out', () => {
    const { model, written } = harness({ rows: 'multiple' });
    model.selection.select('3');
    model.selection.toggle('1');
    model.clipboard.copy({ headers: true });
    expect(written).toEqual(['Name\tPrice\ncedar\t30\nbirch\t20']);
    expect(model.clipboard.lastCopy).toEqual({ rows: 2, cells: 4, unloaded: 0 });
  });

  it('copies cell blocks as TSV rectangles separated by an empty line', () => {
    const { model, written } = harness({ cells: true });
    model.selection.startRange({ rowKey: '1', columnId: 'name' });
    model.selection.extendRange({ rowKey: '2', columnId: 'price' });
    model.selection.startRange({ rowKey: '3', columnId: 'price' }, { add: true });
    model.clipboard.copy();
    expect(written).toEqual(['cedar\t30\nash\t10\n\n20']);
  });

  it('copies the focused row when asked for rows without a selection', () => {
    const { model, written } = harness({ rows: 'multiple' });
    model.focus.focusCell('2', 'name');
    model.clipboard.copyRows({ format: 'json' });
    expect(JSON.parse(written[0])).toEqual([{ name: 'ash', price: '10' }]);
  });
});
