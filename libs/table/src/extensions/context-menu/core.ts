import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { IExtensionInstance, IKeyBinding, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { IMenuContext, TMenuItem } from '../../core/kernel/menu';

declare module '../../core/kernel/contracts' {
  interface ITableEvents {
    readonly 'contextMenu.opened': { readonly context: IMenuContext<unknown> };
  }
}

export interface IMenuPosition {
  /** Relative to the table root. */
  readonly left: number;
  readonly top: number;
}

export interface IOpenMenu<TRow> {
  readonly context: IMenuContext<TRow>;
  readonly items: readonly TMenuItem[];
  readonly position: IMenuPosition;
}

export interface IContextMenuOptions<TRow> {
  /** Items the application adds before the extensions' ones. */
  readonly items?: (context: IMenuContext<TRow>) => readonly TMenuItem[];
  readonly after?: (context: IMenuContext<TRow>) => readonly TMenuItem[];
  /** `false` hides a built-in item by id. */
  readonly defaults?: Readonly<Record<string, boolean>>;
}

export interface IContextMenuSlice<TRow> {
  readonly open: IOpenMenu<TRow> | null;
  itemsFor(context: IMenuContext<TRow>): readonly TMenuItem[];
  openAt(context: IMenuContext<TRow>, position: IMenuPosition): void;
  close(): void;
}

function isSeparator(item: TMenuItem): item is { readonly separator: true } {
  return 'separator' in item;
}

/** Drops separators at the edges and doubled ones, so hidden items leave no gaps. */
export function tidyMenu(items: readonly TMenuItem[]): readonly TMenuItem[] {
  const result: TMenuItem[] = [];
  for (const item of items) {
    const last = result.at(-1);
    if (isSeparator(item) && (last === undefined || isSeparator(last))) {
      continue;
    }
    result.push(item);
  }
  while (result.length > 0 && isSeparator(result[result.length - 1])) {
    result.pop();
  }
  return result;
}

class ContextMenuSlice<TRow> implements IContextMenuSlice<TRow> {
  open: IOpenMenu<TRow> | null = null;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    private readonly options: IContextMenuOptions<TRow>
  ) {
    makeAutoObservable<ContextMenuSlice<TRow>, 'kernel' | 'options'>(
      this,
      { kernel: false, options: false, itemsFor: false },
      { autoBind: true }
    );
  }

  itemsFor(context: IMenuContext<TRow>): readonly TMenuItem[] {
    const own = this.kernel
      .menu(context)
      .filter(item => isSeparator(item) || this.options.defaults?.[item.id] !== false);
    const before = this.options.items?.(context) ?? [];
    const after = this.options.after?.(context) ?? [];
    return tidyMenu([
      ...before,
      ...(before.length > 0 ? [{ separator: true } as const] : []),
      ...own,
      ...(after.length > 0 ? [{ separator: true } as const] : []),
      ...after,
    ]);
  }

  openAt(context: IMenuContext<TRow>, position: IMenuPosition): void {
    const items = this.itemsFor(context);
    if (items.length === 0) {
      this.open = null;
      return;
    }
    this.open = { context, items, position };
    this.kernel.events.emit('contextMenu.opened', { context });
  }

  close(): void {
    this.open = null;
  }
}

/** The context of the focused cell, for the keyboard shortcut. */
export function focusedMenuContext<TRow>(
  kernel: ITableKernel<TRow, unknown>
): IMenuContext<TRow> | undefined {
  const focused = kernel.focus.cell;
  if (focused === null) {
    return undefined;
  }
  const index = kernel.rows.indexOf(focused.rowKey);
  const displayRow = isNil(index) ? undefined : kernel.rows.rowAt(index);
  return {
    target: 'cell',
    columnId: focused.columnId,
    rowKey: focused.rowKey,
    row: displayRow?.kind === 'leaf' ? displayRow.row : undefined,
  };
}

export function contextMenu<TRow = never>(
  options: IContextMenuOptions<TRow> = {}
): ITableExtension<TRow, 'contextMenu', IContextMenuSlice<TRow>> {
  return {
    id: 'contextMenu',
    create(kernel): IExtensionInstance<TRow, IContextMenuSlice<TRow>> {
      const slice = new ContextMenuSlice(kernel, options);
      const keys: readonly IKeyBinding<TRow>[] = [
        {
          key: 'Shift+F10',
          target: 'cell',
          run: () => {
            const context = focusedMenuContext(kernel);
            if (context === undefined) {
              return false;
            }
            slice.openAt(context, { left: 0, top: 0 });
            return slice.open !== null;
          },
        },
        { key: 'Escape', target: 'cell', run: () => slice.open !== null && (slice.close(), true) },
      ];
      return {
        slice,
        keys,
        menu: ({ target }) =>
          target !== 'header'
            ? []
            : [
                { separator: true },
                {
                  id: 'table.resetColumns',
                  label: 'menu.table.resetColumns',
                  section: 'table',
                  run: () => void kernel.columns.reset(),
                },
                {
                  id: 'table.resetState',
                  label: 'menu.table.resetState',
                  section: 'table',
                  danger: true,
                  run: () => kernel.resetState(),
                },
              ],
        dispose: () => undefined,
      };
    },
  };
}
