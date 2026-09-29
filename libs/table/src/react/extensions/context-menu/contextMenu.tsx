import type { MouseEvent } from 'react';

import type { ITableExtension } from '../../../core/kernel/extension';
import type { IMenuContext } from '../../../core/kernel/menu';
import type { IContextMenuOptions, IContextMenuSlice } from '../../../extensions/context-menu/core';
import { contextMenu as contextMenuCore } from '../../../extensions/context-menu/core';
import type { IViewContributions } from '../../slots';
import { withView } from '../withView';
import { MenuPopover } from './MenuPopover';

function positionOf(event: MouseEvent<HTMLElement>): {
  readonly left: number;
  readonly top: number;
} {
  const root = event.currentTarget.closest('.ft');
  const rect = root?.getBoundingClientRect();
  return { left: event.clientX - (rect?.left ?? 0), top: event.clientY - (rect?.top ?? 0) };
}

function contextMenuView<TRow>(slice: IContextMenuSlice<TRow>): IViewContributions<TRow> {
  const opener = (context: IMenuContext<TRow>) => (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    slice.openAt(context, positionOf(event));
  };
  return {
    'cell.props': [
      {
        id: 'contextMenu.cell',
        props: ({ column, rowKey, row }) => ({
          onContextMenu: opener({
            target: 'cell',
            columnId: column.id,
            groupId: undefined,
            rowKey,
            row,
          }),
        }),
      },
    ],
    'header.cell.props': [
      {
        id: 'contextMenu.header',
        props: ({ column }) => ({
          onContextMenu: opener({
            target: 'header',
            columnId: column.id,
            groupId: undefined,
            rowKey: undefined,
            row: undefined,
          }),
        }),
      },
    ],
    'header.group.props': [
      {
        id: 'contextMenu.group',
        props: ({ group }) => ({
          onContextMenu: opener({
            target: 'group',
            columnId: undefined,
            groupId: group.id,
            rowKey: undefined,
            row: undefined,
          }),
        }),
      },
    ],
    floating: [{ id: 'contextMenu.menu', render: MenuPopover }],
  };
}

/** Right click, Shift+F10 or a long press opens the items every extension offers for a cell, a column header or a group header. */
export function contextMenu<TRow = never>(
  options: IContextMenuOptions<TRow> = {}
): ITableExtension<TRow, 'contextMenu', IContextMenuSlice<TRow>> {
  return withView(contextMenuCore<TRow>(options), contextMenuView);
}
