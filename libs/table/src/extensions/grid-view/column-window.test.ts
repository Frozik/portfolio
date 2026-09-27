import type { IColumnLayout } from '../../core/columns/columns-model';
import { columnWindow } from './column-window';

function layouts(): IColumnLayout<unknown>[] {
  const widths: [string, 'left' | 'center' | 'right', number][] = [
    ['pin', 'left', 50],
    ['a', 'center', 100],
    ['b', 'center', 100],
    ['c', 'center', 100],
    ['d', 'center', 100],
    ['end', 'right', 50],
  ];
  let offset = 0;
  return widths.map(([id, section, width], index) => {
    const layout = {
      id,
      definition: { id, title: id, kind: 'text' as const, value: () => undefined },
      section,
      index,
      width,
      offset,
      stickyOffset: section === 'center' ? undefined : 0,
    };
    offset += width;
    return layout;
  });
}

describe('columnWindow', () => {
  it('renders every column when there is no viewport to clip against', () => {
    expect(columnWindow(layouts(), 0, undefined, 0).columns.map(layout => layout.id)).toEqual([
      'pin',
      'a',
      'b',
      'c',
      'd',
      'end',
    ]);
  });

  it('keeps the pins, the intersecting centre columns and spacers for the rest', () => {
    const window = columnWindow(layouts(), 200, 250, 0);
    expect(window.columns.map(layout => layout.id)).toEqual(['pin', 'c', 'd', 'end']);
    expect(window.leftSpacer).toBe(200);
    expect(window.rightSpacer).toBe(0);
  });

  it('extends the window by the overscan', () => {
    const window = columnWindow(layouts(), 200, 250, 1);
    expect(window.columns.map(layout => layout.id)).toEqual(['pin', 'b', 'c', 'd', 'end']);
    expect(window.leftSpacer).toBe(100);
  });
});
