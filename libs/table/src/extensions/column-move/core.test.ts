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
  it('places the column where it would land while hovering and fixes it there on drop, in the group its neighbours share', () => {
    const model = table();
    expect(model.columnMove.reasonAgainst('b')).toBeUndefined();
    model.columnMove.begin('a');
    model.columnMove.hover(1);
    expect(model.columnMove.drag?.targetIndex).toBe(1);
    expect(model.columns.visibleIds).toEqual(['b', 'a', 'c', 'd']);
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'a', 'c']);
    expect(model.columns.state.map(state => state.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(model.columnMove.drop()).toEqual({ ok: true });
    expect(model.columns.visibleIds).toEqual(['b', 'a', 'c', 'd']);
    expect(model.columns.state.map(state => state.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'a', 'c']);
  });

  it('keeps the column where it was last allowed when the pointer leaves the targets, and returns it on cancel', () => {
    const model = table();
    model.columnMove.begin('a');
    model.commands.guard('columns.move', ({ toIndex }) =>
      toIndex === 3 ? 'app.lastStaysLast' : undefined
    );
    model.columnMove.hover(2);
    model.columnMove.hover(3);
    model.columnMove.hover(undefined);
    expect(model.columnMove.drag?.targetIndex).toBe(2);
    expect(model.columns.visibleIds).toEqual(['b', 'c', 'a', 'd']);
    model.columnMove.cancel();
    expect(model.columnMove.drag).toBeNull();
    expect(model.columns.visibleIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('joins the group whose header the column is dropped on, and leaves it when dropped beside', () => {
    const model = table();
    model.columnMove.begin('d');
    model.columnMove.hover(3, 'pair');
    expect(model.columnMove.drag).toEqual({ columnId: 'd', targetIndex: 3, targetGroup: 'pair' });
    expect(model.columnGroups.leavesOf('pair')).toEqual(['b', 'c', 'd']);
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
