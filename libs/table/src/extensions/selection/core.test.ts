import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { sorting } from '../sorting/core';
import type { ISelectionOptions } from './contracts';
import { selection } from './core';

type TItem = { readonly id: number; readonly name: string; readonly locked?: boolean };

const items: TItem[] = [
  { id: 1, name: 'cedar' },
  { id: 2, name: 'ash', locked: true },
  { id: 3, name: 'birch' },
  { id: 4, name: 'oak' },
];

const define = column<TItem>();

function table(options: ISelectionOptions<TItem> = {}) {
  return createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [sorting(), selection<TItem>(options)],
    context: undefined,
  });
}

describe('selection: rows', () => {
  it('keeps one row in single mode and swaps it on the next select', () => {
    const model = table({ rows: 'single' });
    model.selection.select('1');
    model.selection.toggle('3');
    expect(model.selection.isSelected('1')).toBe(false);
    expect(model.selection.isSelected('3')).toBe(true);
    expect(model.selection.count).toBe(1);
  });

  it('accumulates toggles in multiple mode and extends a range from the anchor in display order', () => {
    const model = table({ rows: 'multiple' });
    model.sorting.set([{ columnId: 'name', direction: 'asc' }]);
    model.selection.select('2');
    model.selection.range('3');
    expect(model.selection.selectedRows().map(row => row.name)).toEqual(['ash', 'birch']);
    model.selection.toggle('4');
    expect(model.selection.count).toBe(3);
  });

  it('selects every row as an inverted set so the count follows the row count', () => {
    const model = table({ rows: 'multiple' });
    model.selection.selectAll();
    model.selection.toggle('1');
    expect(model.selection.headerState).toBe('some');
    expect(model.selection.count).toBe(3);
    expect(model.selection.isSelected('4')).toBe(true);
  });

  it('refuses rows the application declares not selectable and skips them in ranges', () => {
    const model = table({ rows: 'multiple', selectable: row => row.locked !== true });
    expect(model.selection.toggle('2')).toEqual({ ok: false, reason: 'selection.notSelectable' });
    model.selection.select('1');
    model.selection.range('3');
    expect(model.selection.selectedRows().map(row => row.id)).toEqual([1, 3]);
  });

  it('hides the checkbox column and clears the selection when rows are switched off at runtime', () => {
    const model = table({ rows: 'multiple', checkboxes: true });
    model.selection.select('1');
    expect(model.columns.visible[0].id).toBe('selection');
    model.selection.setMode({ rows: 'none' });
    expect(model.columns.visible.map(layout => layout.id)).toEqual(['name', 'id']);
    expect(model.selection.count).toBe(0);
    expect(model.selection.toggle('1').ok).toBe(false);
  });

  it('persists the mode always and the selected keys only when asked', () => {
    const plain = table({ rows: 'multiple' });
    plain.selection.select('1');
    expect(plain.state.extensions.selection).toEqual({ mode: { rows: 'multiple', cells: false } });

    const persisted = table({ rows: 'multiple', persistSelection: true });
    persisted.selection.select('1');
    const restored = table({ rows: 'single', persistSelection: true });
    restored.applyState(persisted.state);
    expect(restored.selection.mode.rows).toBe('multiple');
    expect(restored.selection.isSelected('1')).toBe(true);
  });
});

describe('selection: cell blocks', () => {
  it('describes a block by its corners and tells each cell whether it is inside and on which edge', () => {
    const model = table({ cells: true });
    model.selection.startRange({ rowKey: '1', columnId: 'name' });
    model.selection.extendRange({ rowKey: '3', columnId: 'id' });
    expect(model.selection.summary).toEqual({ cells: 6, rows: 3 });
    expect(model.selection.cellState('2', 'name')).toEqual({
      selected: true,
      edges: { top: false, bottom: false, left: true, right: false },
    });
    expect(model.selection.cellState('4', 'name').selected).toBe(false);
  });

  it('adds a second block, selects everything and clears on demand', () => {
    const model = table({ cells: true });
    model.selection.startRange({ rowKey: '1', columnId: 'name' });
    model.selection.startRange({ rowKey: '4', columnId: 'id' }, { add: true });
    expect(model.selection.blocks).toHaveLength(2);
    model.selection.selectAllCells();
    expect(model.selection.summary).toEqual({ cells: 8, rows: 4 });
    model.selection.clear();
    expect(model.selection.hasSelection).toBe(false);
  });

  it('is unavailable when the mode has no cell selection', () => {
    const model = table();
    expect(model.selection.startRange({ rowKey: '1', columnId: 'name' })).toEqual({
      ok: false,
      reason: 'selection.cellsOff',
    });
  });
});
