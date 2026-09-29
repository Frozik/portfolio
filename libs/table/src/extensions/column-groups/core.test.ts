import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { columnGroups } from './core';

type TItem = { readonly id: number };
const define = column<TItem>();

function table() {
  const model = createTable({
    columns: ['a', 'b', 'c', 'd', 'e'].map(id =>
      define({ id, title: id.toUpperCase(), kind: 'text', value: row => String(row.id) })
    ),
    rowKey: 'id',
    rows: clientRows<TItem>({ rows: () => [] }),
    extensions: [
      columnGroups({
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

  it('moves a column into the group its new neighbours share and out of its own when dropped beside it', () => {
    const model = table();
    model.events.emit('columnMove.drop', { columnId: 'a', toIndex: 1, groupId: undefined });
    model.columns.move('a', 1);
    expect(model.columns.visibleIds).toEqual(['b', 'a', 'c', 'd', 'e']);
    expect(model.columnGroups.pathOf('a').map(group => group.id)).toEqual(['pair']);
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'a', 'c']);

    model.events.emit('columnMove.drop', { columnId: 'c', toIndex: 4, groupId: undefined });
    model.columns.move('c', 4);
    expect(model.columns.visibleIds).toEqual(['b', 'a', 'd', 'e', 'c']);
    expect(model.columnGroups.pathOf('c')).toEqual([]);
    expect(model.columnGroups.level(0).map(span => [span.group?.id, span.columnIds])).toEqual([
      ['pair', ['b', 'a']],
      [undefined, ['d']],
      ['tail', ['e']],
      [undefined, ['c']],
    ]);
  });

  it('joins the group a column is dropped on, as its first or last column, and keeps that in the table state', () => {
    const model = table();
    model.events.emit('columnMove.drop', { columnId: 'd', toIndex: 4, groupId: 'tail' });
    model.columns.move('d', 4);
    expect(model.columns.visibleIds).toEqual(['a', 'b', 'c', 'e', 'd']);
    expect(model.columnGroups.leavesOf('tail')).toEqual(['e', 'd']);
    expect(model.state.extensions.columnGroups).toEqual({ d: 'tail' });

    model.applyState({ extensions: { columnGroups: { a: 'pair', b: null } } });
    expect(model.columnGroups.pathOf('a').map(group => group.id)).toEqual(['pair']);
    expect(model.columnGroups.pathOf('b')).toEqual([]);
    model.resetState();
    expect(model.columnGroups.membership.size).toBe(0);
  });

  it('offers a group header its own menu: pin the group as one, hide its columns', () => {
    const model = table();
    const context = {
      target: 'group',
      columnId: undefined,
      groupId: 'pair',
      rowKey: undefined,
      row: undefined,
    } as const;
    const items = model.menu(context).flatMap(item => ('separator' in item ? [] : [item]));
    expect(items.map(item => item.id)).toEqual([
      'columnGroups.pin.left',
      'columnGroups.pin.right',
      'columnGroups.pin.none',
      'columnGroups.hide',
    ]);
    expect(items.find(item => item.id === 'columnGroups.pin.none')?.disabled).toBe(true);
    items.find(item => item.id === 'columnGroups.pin.left')?.run();
    expect(model.columns.pinOf('b')).toBe('left');
    expect(model.columns.pinOf('c')).toBe('left');
    items.find(item => item.id === 'columnGroups.hide')?.run();
    expect(model.columns.isHidden('b')).toBe(true);
    expect(model.columns.isHidden('c')).toBe(true);
  });

  it('pins a group as one and lists its leaves', () => {
    const model = table();
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'c']);
    expect(model.columnGroups.pinGroup('pair', 'left')).toEqual({ ok: true });
    expect(model.columns.visibleIds).toEqual(['b', 'c', 'a', 'd', 'e']);
  });
});
