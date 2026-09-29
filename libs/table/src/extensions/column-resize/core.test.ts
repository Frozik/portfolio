import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import type { IColumnMeasure, IColumnResizeOptions } from './core';
import { columnResize } from './core';

type TItem = { readonly id: number; readonly name: string; readonly note: string };

const define = column<TItem>();

function harness(options: IColumnResizeOptions = {}) {
  const measures = new Map<string, IColumnMeasure>();
  const model = createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({ id: 'note', title: 'Note', kind: 'text', value: row => row.note, minWidth: 60 }),
      define({ id: 'fixed', title: 'Fixed', kind: 'text', value: row => row.name, width: 100 }),
      define({ id: 'flex', title: 'Flex', kind: 'text', value: row => row.name, flex: 1 }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => [{ id: 1, name: 'cedar', note: 'long' }] }),
    extensions: [columnResize<TItem>(options)],
    context: undefined,
  });
  model.columnResize.attachMeasurePort({ measureColumn: id => measures.get(id) });
  const width = (id: string): number | undefined => model.columns.visibleById.get(id)?.width;
  const measure = (id: string, header: number, content?: number): void =>
    void measures.set(id, { header, content });
  return { model, width, measure };
}

describe('column autosize', () => {
  it('grows a column to its content by default and never shrinks it back', () => {
    const { model, width, measure } = harness();
    measure('name', 50, 220);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(220);
    measure('name', 50, 90);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(220);
  });

  it('follows the content both ways in fit mode', () => {
    const { model, width, measure } = harness({ autoSize: 'fit' });
    measure('name', 50, 220);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(220);
    measure('name', 50, 90);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(90);
  });

  it('leaves declared, flex, user-dragged widths alone and stays between minWidth and the ceiling', () => {
    const { model, width, measure } = harness({ autoSize: 'fit', autoSizeMaxWidth: 300 });
    measure('fixed', 50, 250);
    measure('flex', 50, 250);
    measure('name', 50, 900);
    measure('note', 10, 10);
    model.columnResize.resize('flex', 120);
    model.columnResize.autoSizePass();
    expect(width('fixed')).toBe(100);
    expect(width('flex')).toBe(120);
    expect(width('name')).toBe(300);
    expect(width('note')).toBe(60);
    model.columnResize.resize('name', 130);
    measure('name', 50, 900);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(130);
  });

  it('sizes by the header alone, once, in header mode', () => {
    const { model, width, measure } = harness({ autoSize: 'header' });
    measure('name', 70, 300);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(70);
    measure('name', 200, 300);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(70);
  });

  it('waits for the first rows and sizes once by header and data in firstData mode', () => {
    const { model, width, measure } = harness({ autoSize: 'firstData' });
    measure('name', 70, undefined);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(160);
    measure('name', 70, 210);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(210);
    measure('name', 70, 300);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(210);
  });

  it('starts over when the mode changes and does nothing when off', () => {
    const { model, width, measure } = harness({ autoSize: 'off' });
    measure('name', 70, 210);
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(160);
    model.columnResize.setAutoSizeMode('firstData');
    model.columnResize.autoSizePass();
    expect(width('name')).toBe(210);
  });
});
