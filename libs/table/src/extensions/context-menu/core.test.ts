import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { sorting } from '../sorting/core';
import { contextMenu, tidyMenu } from './core';

type TItem = { readonly id: number; readonly name: string };

const items: TItem[] = [{ id: 1, name: 'cedar' }];
const define = column<TItem>();

describe('context menu', () => {
  it('assembles the application items around the extensions items and drops hidden ones', () => {
    const model = createTable({
      columns: [define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name })],
      rowKey: 'id',
      rows: clientRows({ rows: () => items }),
      extensions: [
        sorting(),
        contextMenu<TItem>({
          items: context => [
            { id: 'app.open', label: `Open ${context.row?.name ?? ''}`, run: () => undefined },
          ],
          defaults: { 'sorting.desc': false },
        }),
      ],
      context: undefined,
    });
    const menu = model.contextMenu.itemsFor({
      target: 'header',
      columnId: 'name',
      rowKey: undefined,
      row: undefined,
    });
    const ids = menu.map(item => ('separator' in item ? '-' : item.id));
    expect(ids).toEqual([
      'app.open',
      '-',
      'sorting.asc',
      'sorting.clear',
      '-',
      'table.resetColumns',
      'table.resetState',
    ]);
  });

  it('opens at a position with the items of the target and closes', () => {
    const model = createTable({
      columns: [define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name })],
      rowKey: 'id',
      rows: clientRows({ rows: () => items }),
      extensions: [sorting(), contextMenu<TItem>()],
      context: undefined,
    });
    model.contextMenu.openAt(
      { target: 'header', columnId: 'name', rowKey: undefined, row: undefined },
      { left: 10, top: 20 }
    );
    expect(model.contextMenu.open?.position).toEqual({ left: 10, top: 20 });
    expect(model.contextMenu.open?.items.length).toBeGreaterThan(0);
    model.contextMenu.close();
    expect(model.contextMenu.open).toBeNull();
  });

  it('tidies separators at the edges and in a row', () => {
    const separator = { separator: true } as const;
    const item = { id: 'x', label: 'x', run: () => undefined };
    expect(tidyMenu([separator, item, separator, separator, item, separator])).toEqual([
      item,
      separator,
      item,
    ]);
  });
});
