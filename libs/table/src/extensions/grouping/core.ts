import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { TAnyColumn } from '../../core/columns/column';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, IKeyBinding, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { IGroupRow, TDisplayRow } from '../../core/rows/display-row';
import type { TGroupOrder } from './tree';
import { groupKey, groupTree, isGroupKey, totalsRow } from './tree';

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'grouping.groupBy': { readonly columnIds: readonly string[] };
    readonly 'grouping.toggle': { readonly path: readonly string[]; readonly expanded: boolean };
  }
  interface ITableEvents {
    readonly 'grouping.changed': { readonly groupBy: readonly string[] };
    /** A leaf was made visible by expanding its groups; the view scrolls to it. */
    readonly 'grouping.revealed': { readonly rowKey: string };
  }
}

export const GROUPING_STAGE_ORDER = 150;

export type TDefaultExpanded = 'all' | 'none' | number;
export type TGroupDisplay = 'row' | 'column';

export interface IGroupingOptions<TRow> {
  readonly groupBy?: readonly string[];
  readonly defaultExpanded?: TDefaultExpanded;
  /** `row`: a full-width group row; `column`: a grid row with the expander in the first column and aggregates in their cells. */
  readonly display?: TGroupDisplay;
  readonly totals?: { readonly position: 'top' | 'bottom'; readonly title: string };
  readonly groupOrder?: TGroupOrder<TRow>;
  readonly showCount?: boolean;
  readonly persistExpanded?: boolean;
}

export interface IGroupingState {
  readonly groupBy: readonly string[];
  readonly toggled?: readonly string[];
}

export interface IGroupingSlice<TRow> {
  readonly groupBy: readonly string[];
  readonly display: TGroupDisplay;
  readonly showCount: boolean;
  readonly totals: IGroupingOptions<TRow>['totals'];
  isExpanded(path: readonly string[]): boolean;
  reasonAgainst(columnId: string): string | undefined;
  /** The group a display row key belongs to, when it is in view. */
  groupOf(rowKey: string): IGroupRow<TRow> | undefined;
  setGroupBy(columnIds: readonly string[]): TCommandOutcome;
  addGroup(columnId: string): TCommandOutcome;
  removeGroup(columnId: string): TCommandOutcome;
  toggle(path: readonly string[], expanded?: boolean): TCommandOutcome;
  expandAll(level?: number): void;
  collapseAll(): void;
  /** Expands every group above the leaf; the index it lands on, or `undefined` when the row is unknown. */
  reveal(rowKey: string): number | undefined;
}

class GroupingSlice<TRow> implements IGroupingSlice<TRow> {
  groupBy: readonly string[];
  readonly display: TGroupDisplay;
  readonly showCount: boolean;
  readonly totals: IGroupingOptions<TRow>['totals'];
  /** Paths whose expansion differs from the default of their level. */
  private toggled: ReadonlySet<string> = new Set();
  private defaultExpanded: TDefaultExpanded;
  private readonly groupOrder: TGroupOrder<TRow> | undefined;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IGroupingOptions<TRow>
  ) {
    this.groupBy = options.groupBy ?? [];
    this.display = options.display ?? 'row';
    this.showCount = options.showCount ?? true;
    this.totals = options.totals;
    this.defaultExpanded = options.defaultExpanded ?? 'all';
    this.groupOrder = options.groupOrder;
    makeAutoObservable<
      GroupingSlice<TRow>,
      'kernel' | 'groupOrder' | 'expandedByDefault' | 'leafRows'
    >(
      this,
      {
        kernel: false,
        groupOrder: false,
        isExpanded: false,
        reasonAgainst: false,
        groupOf: false,
        apply: false,
        expandedByDefault: false,
        leafRows: false,
        readState: false,
      },
      { autoBind: true }
    );
  }

  private get groupColumns(): readonly TAnyColumn<TRow>[] {
    return this.groupBy.flatMap(columnId => this.kernel.columns.byId.get(columnId) ?? []);
  }

  private get aggregatedColumns(): readonly TAnyColumn<TRow>[] {
    return this.kernel.columns.all.filter(column => !isNil(column.aggregate));
  }

  private expandedByDefault(level: number): boolean {
    const { defaultExpanded } = this;
    if (typeof defaultExpanded === 'number') {
      return level < defaultExpanded;
    }
    return defaultExpanded === 'all';
  }

  isExpanded(path: readonly string[]): boolean {
    const byDefault = this.expandedByDefault(path.length - 1);
    return this.toggled.has(groupKey(path)) ? !byDefault : byDefault;
  }

  reasonAgainst(columnId: string): string | undefined {
    const column = this.kernel.columns.byId.get(columnId);
    if (
      column === undefined ||
      column.groupable === false ||
      this.kernel.columns.isService(columnId)
    ) {
      return 'grouping.notGroupable';
    }
    return this.kernel.commands.reasonAgainst('grouping.groupBy', { columnIds: [columnId] });
  }

  groupOf(rowKey: string): IGroupRow<TRow> | undefined {
    const index = this.kernel.rows.indexOf(rowKey);
    const displayRow = isNil(index) ? undefined : this.kernel.rows.rowAt(index);
    return displayRow?.kind === 'group' ? displayRow.group : undefined;
  }

  setGroupBy(columnIds: readonly string[]): TCommandOutcome {
    const blocked = columnIds
      .map(columnId => this.reasonAgainst(columnId))
      .find(reason => reason !== undefined);
    if (blocked !== undefined) {
      return { ok: false, reason: blocked };
    }
    return this.kernel.commands.run('grouping.groupBy', { columnIds }, () => {
      this.groupBy = columnIds;
      this.toggled = new Set();
      this.kernel.events.emit('grouping.changed', { groupBy: columnIds });
    });
  }

  addGroup(columnId: string): TCommandOutcome {
    return this.groupBy.includes(columnId)
      ? { ok: true }
      : this.setGroupBy([...this.groupBy, columnId]);
  }

  removeGroup(columnId: string): TCommandOutcome {
    return this.setGroupBy(this.groupBy.filter(id => id !== columnId));
  }

  toggle(path: readonly string[], expanded = !this.isExpanded(path)): TCommandOutcome {
    return this.kernel.commands.run('grouping.toggle', { path, expanded }, () => {
      const key = groupKey(path);
      const next = new Set(this.toggled);
      if (expanded === this.expandedByDefault(path.length - 1)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      this.toggled = next;
    });
  }

  expandAll(level?: number): void {
    this.defaultExpanded = level === undefined ? 'all' : level + 1;
    this.toggled = new Set();
  }

  collapseAll(): void {
    this.defaultExpanded = 'none';
    this.toggled = new Set();
  }

  reveal(rowKey: string): number | undefined {
    const row = this.leafRows().find(candidate => this.kernel.rowKey(candidate) === rowKey);
    if (row === undefined) {
      return undefined;
    }
    const path = this.groupColumns.map(column => {
      const value = column.value(row);
      return isNil(value) ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
    for (let depth = 1; depth <= path.length; depth += 1) {
      const partial = path.slice(0, depth);
      if (!this.isExpanded(partial)) {
        this.toggle(partial, true);
      }
    }
    const index = this.kernel.rows.indexOf(rowKey);
    if (index !== undefined) {
      this.kernel.events.emit('grouping.revealed', { rowKey });
    }
    return index;
  }

  readState(): IGroupingState {
    return { groupBy: this.groupBy, toggled: [...this.toggled] };
  }

  writeState(state: Partial<IGroupingState>, withToggled: boolean): void {
    this.groupBy = state.groupBy ?? [];
    this.toggled = new Set(withToggled ? (state.toggled ?? []) : []);
    this.kernel.events.emit('grouping.changed', { groupBy: this.groupBy });
  }

  apply(rows: readonly TDisplayRow<TRow>[]): readonly TDisplayRow<TRow>[] {
    return groupTree(rows, {
      columns: this.groupColumns,
      aggregated: this.aggregatedColumns,
      isExpanded: path => this.isExpanded(path),
      order: this.groupOrder,
    });
  }

  pinnedRows(side: 'top' | 'bottom'): readonly TDisplayRow<TRow>[] {
    if (this.totals === undefined || this.totals.position !== side) {
      return [];
    }
    return [totalsRow(this.leafRows(), this.aggregatedColumns, this.totals.title)];
  }

  /** Every leaf that passed the filters, collapsed groups included. */
  private leafRows(): readonly TRow[] {
    const source = this.kernel.rows;
    const rowCount = source.rowCount ?? 0;
    const rows: TRow[] = [];
    for (let index = 0; index < rowCount; index += 1) {
      const displayRow = source.rowAt(index);
      if (displayRow.kind === 'group' && displayRow.group.level === 0) {
        rows.push(...displayRow.group.rows);
      } else if (displayRow.kind === 'leaf' && this.groupBy.length === 0) {
        rows.push(displayRow.row);
      }
    }
    return rows;
  }
}

function groupingKeys<TRow>(slice: GroupingSlice<TRow>): readonly IKeyBinding<TRow>[] {
  const onFocusedGroup =
    (run: (group: IGroupRow<TRow>) => boolean) =>
    (kernel: ITableKernel<TRow, unknown>): boolean => {
      const rowKey = kernel.focus.cell?.rowKey;
      const group = rowKey === undefined || !isGroupKey(rowKey) ? undefined : slice.groupOf(rowKey);
      return group !== undefined && run(group);
    };
  return [
    {
      key: 'ArrowRight',
      target: 'cell',
      run: onFocusedGroup(group => !group.expanded && slice.toggle(group.path, true).ok),
    },
    {
      key: 'ArrowLeft',
      target: 'cell',
      run: onFocusedGroup(group => group.expanded && slice.toggle(group.path, false).ok),
    },
    { key: 'Enter', target: 'cell', run: onFocusedGroup(group => slice.toggle(group.path).ok) },
  ];
}

export function grouping<TRow = never>(
  options: IGroupingOptions<TRow> = {}
): ITableExtension<TRow, 'grouping', IGroupingSlice<TRow>> {
  return {
    id: 'grouping',
    create(kernel): IExtensionInstance<TRow, IGroupingSlice<TRow>> {
      const slice = new GroupingSlice(kernel, options);
      return {
        slice,
        pipeline: { order: GROUPING_STAGE_ORDER, apply: rows => slice.apply(rows) },
        pinnedRows: side => slice.pinnedRows(side),
        menu: ({ target, columnId }) => {
          const grouped = columnId !== undefined && slice.groupBy.includes(columnId);
          const column =
            target === 'header' &&
            columnId !== undefined &&
            slice.reasonAgainst(columnId) === undefined
              ? [
                  {
                    id: 'grouping.toggle',
                    label: grouped ? 'menu.group.remove' : 'menu.group.add',
                    section: 'grouping',
                    run: () =>
                      void (grouped ? slice.removeGroup(columnId) : slice.addGroup(columnId)),
                  },
                ]
              : [];
          const tree =
            slice.groupBy.length === 0
              ? []
              : [
                  {
                    id: 'grouping.expandAll',
                    label: 'menu.group.expandAll',
                    section: 'grouping',
                    run: () => slice.expandAll(),
                  },
                  {
                    id: 'grouping.collapseAll',
                    label: 'menu.group.collapseAll',
                    section: 'grouping',
                    run: () => slice.collapseAll(),
                  },
                ];
          return [...column, ...tree];
        },
        keys: groupingKeys(slice),
        state: {
          read: () => {
            const state = slice.readState();
            return options.persistExpanded === true ? state : { groupBy: state.groupBy };
          },
          write: value =>
            slice.writeState(value as Partial<IGroupingState>, options.persistExpanded === true),
          reset: () => slice.writeState({ groupBy: options.groupBy ?? [] }, false),
        },
        dispose: () => undefined,
      };
    },
  };
}
