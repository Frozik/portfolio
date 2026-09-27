import { makeAutoObservable } from 'mobx';

import { columnTitle } from '../../core/columns/column';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';

export interface IColumnVisibilityEntry {
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;
  /** Why the column cannot be hidden right now, if it cannot. */
  readonly lockedReason: string | undefined;
}

export interface IColumnVisibilitySlice {
  readonly entries: readonly IColumnVisibilityEntry[];
  setVisible(columnId: string, visible: boolean): TCommandOutcome;
  showAll(): void;
}

class ColumnVisibilitySlice<TRow> implements IColumnVisibilitySlice {
  constructor(private readonly kernel: ITableKernel<TRow, unknown>) {
    makeAutoObservable<ColumnVisibilitySlice<TRow>, 'kernel'>(
      this,
      { kernel: false },
      { autoBind: true }
    );
  }

  get entries(): readonly IColumnVisibilityEntry[] {
    const { columns, commands } = this.kernel;
    return columns.orderedIds.flatMap(id => {
      const definition = columns.byId.get(id);
      if (definition === undefined || (definition.kind === 'custom' && definition.title === '')) {
        return [];
      }
      const visible = !columns.isHidden(id);
      return [
        {
          id,
          title: columnTitle(definition),
          visible,
          lockedReason: visible
            ? commands.reasonAgainst('columns.setVisible', { columnId: id, visible: false })
            : undefined,
        },
      ];
    });
  }

  setVisible(columnId: string, visible: boolean): TCommandOutcome {
    return this.kernel.columns.setVisible(columnId, visible);
  }

  showAll(): void {
    for (const entry of this.entries) {
      if (!entry.visible) {
        this.kernel.columns.setVisible(entry.id, true);
      }
    }
  }
}

export function columnVisibility<TRow = never>(): ITableExtension<
  TRow,
  'columnVisibility',
  IColumnVisibilitySlice
> {
  return {
    id: 'columnVisibility',
    create(kernel): IExtensionInstance<TRow, IColumnVisibilitySlice> {
      const slice = new ColumnVisibilitySlice(kernel);
      return {
        slice,
        menu: ({ target, columnId }) => {
          if (target !== 'header') {
            return [];
          }
          const entry = slice.entries.find(candidate => candidate.id === columnId);
          return [
            ...(entry === undefined
              ? []
              : [
                  {
                    id: 'columnVisibility.hide',
                    label: 'menu.columns.hide',
                    section: 'columns',
                    disabled: entry.lockedReason ?? false,
                    run: () => void slice.setVisible(entry.id, false),
                  },
                ]),
            {
              id: 'columnVisibility.showAll',
              label: 'menu.columns.showAll',
              section: 'columns',
              disabled: slice.entries.every(candidate => candidate.visible),
              run: () => slice.showAll(),
            },
          ];
        },
        dispose: () => undefined,
      };
    },
  };
}
