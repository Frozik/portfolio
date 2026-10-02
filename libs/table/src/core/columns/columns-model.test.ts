import { EventBus } from '@frozik/utils/events/event-bus';
import { CommandBus } from '../kernel/command-bus';
import type { ITableCommands, ITableEvents } from '../kernel/contracts';
import { column } from './column';
import { ColumnsModel } from './columns-model';

type TItem = { readonly name: string; readonly price: number };

const define = column<TItem>();

function model(viewportWidth?: number) {
  const columns = new ColumnsModel<TItem>(
    [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name, width: 100 }),
      define({
        id: 'price',
        title: 'Price',
        kind: 'number',
        value: row => row.price,
        width: 60,
        pin: 'right',
      }),
      define({
        id: 'note',
        title: 'Note',
        kind: 'text',
        value: row => row.name,
        flex: 1,
        lock: { hide: true },
      }),
    ],
    new CommandBus<ITableCommands>(),
    new EventBus<ITableEvents>()
  );
  columns.setViewportWidth(viewportWidth);
  return columns;
}

describe('ColumnsModel', () => {
  it('lays visible columns out as left pins, centre, right pins with running offsets', () => {
    const columns = model(400);
    columns.pin('name', 'left');

    expect(
      columns.visible.map(layout => [layout.id, layout.section, layout.offset, layout.width])
    ).toEqual([
      ['name', 'left', 0, 100],
      ['note', 'center', 100, 240],
      ['price', 'right', 340, 60],
    ]);
    expect(columns.visible.map(layout => layout.stickyOffset)).toEqual([0, undefined, 0]);
  });

  it('refuses to hide a locked column and the last visible one', () => {
    const columns = model();

    expect(columns.setVisible('note', false)).toEqual({ ok: false, reason: 'lock.hide' });
    expect(columns.setVisible('name', false)).toEqual({ ok: true });
    expect(columns.setVisible('price', false)).toEqual({ ok: true });
    expect(columns.visibleIds).toEqual(['note']);
  });

  it('keeps the user order and widths as state and returns to the definition on reset', () => {
    const columns = model();
    columns.pin('price', null);
    columns.move('price', 0);
    columns.resize('name', 180);

    expect(columns.visibleIds).toEqual(['price', 'name', 'note']);
    expect(columns.state).toEqual([
      { id: 'price', pin: null },
      { id: 'name', width: 180, widthBy: 'user', flex: undefined },
      { id: 'note' },
    ]);

    columns.reset();
    expect(columns.visibleIds).toEqual(['name', 'note', 'price']);
    expect(columns.visible[0].width).toBe(100);
  });

  it('restores persisted state and places a column unknown to it by its definition neighbour', () => {
    const columns = model();
    columns.applyState([{ id: 'note' }, { id: 'name', hidden: true }]);

    expect(columns.orderedIds).toEqual(['note', 'name', 'price']);
    expect(columns.visibleIds).toEqual(['note', 'price']);
  });

  it('refuses a pin that would squeeze the scrolling centre below its minimum', () => {
    const columns = model(150);
    expect(columns.pin('name', 'left')).toEqual({ ok: false, reason: 'columns.pinWidth' });
  });

  it('puts service columns first and never lets them be reordered by state', () => {
    const columns = model();
    columns.setServiceColumns([
      define({ id: 'select', title: '', kind: 'custom', value: () => undefined, width: 32 }),
    ]);
    columns.applyState([{ id: 'price' }, { id: 'name' }, { id: 'note' }]);

    expect(columns.orderedIds).toEqual(['select', 'price', 'name', 'note']);
    expect(columns.state.map(state => state.id)).toEqual(['price', 'name', 'note']);
  });
});
