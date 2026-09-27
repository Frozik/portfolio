import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { columnGroups } from './core';

type TItem = { readonly id: number };
const define = column<TItem>();

function table(marryChildren = true) {
  const model = createTable({
    columns: ['a', 'b', 'c', 'd', 'e'].map(id =>
      define({ id, title: id.toUpperCase(), kind: 'text', value: row => String(row.id) })
    ),
    rowKey: 'id',
    rows: clientRows<TItem>({ rows: () => [] }),
    extensions: [
      columnGroups({
        marryChildren,
        groups: [
          {
            id: 'pair',
            title: 'Pair',
            columns: ['b', { id: 'inner', title: 'Inner', columns: ['c'] }],
          },
          { id: 'tail', title: 'Tail', columns: ['e'] },
        ],
      }),
    ],
    context: undefined,
  });
  model.columns.setViewportWidth(1000);
  return model;
}

describe('columnGroups', () => {
  it('spans each header level over the adjacent visible columns of one group', () => {
    const model = table();
    expect(model.columnGroups.depth).toBe(2);
    expect(model.columnGroups.level(0).map(span => [span.group?.id, span.columnIds])).toEqual([
      [undefined, ['a']],
      ['pair', ['b', 'c']],
      [undefined, ['d']],
      ['tail', ['e']],
    ]);
    expect(model.columnGroups.level(1).map(span => [span.group?.id, span.columnIds])).toEqual([
      [undefined, ['a', 'b']],
      ['inner', ['c']],
      [undefined, ['d', 'e']],
    ]);
  });

  it('keeps married columns together and lets nothing move in between', () => {
    const model = table();
    expect(model.columns.move('b', 4)).toEqual({ ok: false, reason: 'columnGroups.married' });
    expect(model.columns.move('a', 1)).toEqual({ ok: false, reason: 'columnGroups.married' });
    expect(model.columns.move('c', 1)).toEqual({ ok: true });
    expect(model.columns.visibleIds).toEqual(['a', 'c', 'b', 'd', 'e']);
    expect(model.columns.move('a', 4)).toEqual({ ok: true });
  });

  it('pins a group as one and lists its leaves', () => {
    const model = table(false);
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'c']);
    expect(model.columnGroups.pinGroup('pair', 'left')).toEqual({ ok: true });
    expect(model.columns.visibleIds).toEqual(['b', 'c', 'a', 'd', 'e']);
  });
});
