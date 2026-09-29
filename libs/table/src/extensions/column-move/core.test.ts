import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { columnGroups } from '../column-groups/core';
import { columnMove } from './core';

type TItem = { readonly id: number };

const define = column<TItem>();
const text = (id: string) => define({ id, title: id, kind: 'text', value: row => String(row.id) });

function table() {
  return createTable({
    columns: [text('a'), text('b'), text('c'), text('d')],
    rowKey: 'id',
    rows: clientRows({ rows: () => [{ id: 1 }] }),
    extensions: [
      columnMove<TItem>(),
      columnGroups<TItem>({ groups: [{ id: 'pair', title: 'Pair', columns: ['b', 'c'] }] }),
    ],
    context: undefined,
  });
}

describe('column move', () => {
  it('marks where the column would land and drops it there, joining the group its neighbours share', () => {
    const model = table();
    expect(model.columnMove.reasonAgainst('b')).toBeUndefined();
    model.columnMove.begin('a');
    model.columnMove.hover(1);
    expect(model.columnMove.drag?.targetIndex).toBe(1);
    expect(model.columnMove.drop()).toEqual({ ok: true });
    expect(model.columns.visibleIds).toEqual(['b', 'a', 'c', 'd']);
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'a', 'c']);
  });

  it('joins the group whose header the column is dropped on, and leaves it when dropped beside', () => {
    const model = table();
    model.columnMove.begin('d');
    model.columnMove.hover(3, 'pair');
    expect(model.columnMove.drag).toEqual({ columnId: 'd', targetIndex: 3, targetGroup: 'pair' });
    model.columnMove.drop();
    expect(model.columns.visibleIds).toEqual(['a', 'b', 'c', 'd']);
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'c', 'd']);

    model.columnMove.begin('b');
    model.columnMove.hover(0);
    model.columnMove.drop();
    expect(model.columns.visibleIds).toEqual(['b', 'a', 'c', 'd']);
    expect(model.columnGroups.leavesOf('pair')).toEqual(['c', 'd']);
  });

  it('shows no marker and drops nowhere on a locked column', () => {
    const model = createTable({
      columns: [
        text('a'),
        define({
          id: 'b',
          title: 'b',
          kind: 'text',
          value: row => String(row.id),
          lock: { move: true },
        }),
      ],
      rowKey: 'id',
      rows: clientRows({ rows: () => [{ id: 1 }] }),
      extensions: [columnMove<TItem>()],
      context: undefined,
    });
    expect(model.columnMove.reasonAgainst('b')).toBe('lock.move');
    model.columnMove.begin('b');
    expect(model.columnMove.drag).toBeNull();
  });
});
