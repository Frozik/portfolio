import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { gridView, MAX_SCROLL_HEIGHT } from './core';

type TItem = { readonly id: number };

const ROW_HEIGHT = 32;
const ROW_COUNT = 1_000_000;
const VIEWPORT_HEIGHT = 640;

describe('scroll scale', () => {
  it('sizes the body to the browser limit and maps the scrollbar back onto the rows', () => {
    const rows = Array.from({ length: ROW_COUNT }, (_, index) => ({ id: index }));
    const model = createTable({
      columns: [column<TItem>()({ id: 'id', title: 'Id', kind: 'number', value: row => row.id })],
      rowKey: 'id',
      rows: clientRows({ rows: () => rows }),
      extensions: [gridView({ rowHeight: ROW_HEIGHT, overscanRows: 0 })],
      context: undefined,
    });
    const view = model.gridView;
    view.setViewport({ width: 800, height: VIEWPORT_HEIGHT, scrollTop: 0, scrollLeft: 0 });
    expect(view.totalHeight).toBe(ROW_COUNT * ROW_HEIGHT);
    expect(view.scrollHeight).toBe(MAX_SCROLL_HEIGHT);

    view.setViewport({
      width: 800,
      height: VIEWPORT_HEIGHT,
      scrollTop: MAX_SCROLL_HEIGHT / 2,
      scrollLeft: 0,
    });
    expect(view.rowWindow.startIndex).toBe(ROW_COUNT / 2);
    expect(view.rowsOffset).toBeCloseTo(MAX_SCROLL_HEIGHT / 2, 0);
    expect(view.renderedRows[0]?.index).toBe(ROW_COUNT / 2);
  });

  it('leaves small tables untouched', () => {
    const model = createTable({
      columns: [column<TItem>()({ id: 'id', title: 'Id', kind: 'number', value: row => row.id })],
      rowKey: 'id',
      rows: clientRows({ rows: () => [{ id: 1 }, { id: 2 }] }),
      extensions: [gridView({ rowHeight: ROW_HEIGHT })],
      context: undefined,
    });
    expect(model.gridView.scrollScale).toBe(1);
    expect(model.gridView.scrollHeight).toBe(2 * ROW_HEIGHT);
    expect(model.gridView.rowsOffset).toBe(0);
  });
});
