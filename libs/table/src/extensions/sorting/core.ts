import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TMenuItem } from '../../core/kernel/menu';
import type { TDisplayRow } from '../../core/rows/display-row';
import type { ISortItem, TSortDirection } from '../../core/rows/row-query';
import type { TComparator } from './compare';
import { compareByKind, withNullsLast } from './compare';
import type { TSortStep } from './cycle';
import { DEFAULT_SORT_CYCLE, nextInCycle } from './cycle';

declare module '../../core/columns/column' {
  interface IColumnDefinition<TRow, TValue> {
    /** `false` disables sorting; a function replaces the comparator for the column kind. Sorting is on by default. */
    readonly sort?: boolean | TComparator<TRow, TValue>;
  }
}

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'sorting.set': { readonly sort: readonly ISortItem[] };
  }
  interface ITableEvents {
    readonly 'sorting.changed': { readonly sort: readonly ISortItem[] };
  }
}

export const SORTING_STAGE_ORDER = 200;

export type TMultiSort = 'shift' | 'always' | 'never';

export interface ISortingOptions {
  readonly cycle?: readonly TSortStep[];
  readonly multi?: TMultiSort;
}

export interface ISortingSlice {
  readonly sort: readonly ISortItem[];
  readonly multi: TMultiSort;
  directionOf(columnId: string): TSortDirection | undefined;
  /** 1-based position among the sorted columns, for the header badge. */
  priorityOf(columnId: string): number | undefined;
  reasonAgainst(columnId: string): string | undefined;
  toggle(columnId: string, options?: { readonly multi?: boolean }): TCommandOutcome;
  set(sort: readonly ISortItem[]): TCommandOutcome;
  clear(): TCommandOutcome;
}

class SortingSlice<TRow> implements ISortingSlice {
  sort: readonly ISortItem[] = [];
  readonly multi: TMultiSort;
  private readonly cycle: readonly TSortStep[];

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: ISortingOptions
  ) {
    this.cycle = options.cycle ?? DEFAULT_SORT_CYCLE;
    this.multi = options.multi ?? 'shift';
    makeAutoObservable<SortingSlice<TRow>, 'kernel' | 'cycle' | 'isUnsortable' | 'comparatorFor'>(
      this,
      {
        kernel: false,
        cycle: false,
        directionOf: false,
        priorityOf: false,
        reasonAgainst: false,
        apply: false,
        isUnsortable: false,
        comparatorFor: false,
      },
      { autoBind: true }
    );
  }

  directionOf(columnId: string): TSortDirection | undefined {
    return this.sort.find(item => item.columnId === columnId)?.direction;
  }

  priorityOf(columnId: string): number | undefined {
    const index = this.sort.findIndex(item => item.columnId === columnId);
    return index === -1 ? undefined : index + 1;
  }

  reasonAgainst(columnId: string): string | undefined {
    if (this.isUnsortable(columnId)) {
      return 'sorting.disabled';
    }
    return this.kernel.commands.reasonAgainst('sorting.set', {
      sort: [{ columnId, direction: 'asc' }],
    });
  }

  toggle(columnId: string, options: { readonly multi?: boolean } = {}): TCommandOutcome {
    const step = nextInCycle(this.cycle, this.directionOf(columnId) ?? null);
    const keepOthers =
      this.multi === 'always' || (this.multi === 'shift' && options.multi === true);
    const others = keepOthers ? this.sort.filter(item => item.columnId !== columnId) : [];
    return this.set(isNil(step) ? others : [...others, { columnId, direction: step }]);
  }

  set(sort: readonly ISortItem[]): TCommandOutcome {
    if (sort.some(item => this.isUnsortable(item.columnId))) {
      return { ok: false, reason: 'sorting.disabled' };
    }
    return this.kernel.commands.run('sorting.set', { sort }, () => {
      this.sort = sort;
      this.kernel.events.emit('sorting.changed', { sort });
    });
  }

  clear(): TCommandOutcome {
    return this.set([]);
  }

  apply(rows: readonly TDisplayRow<TRow>[]): readonly TDisplayRow<TRow>[] {
    if (this.sort.length === 0) {
      return rows;
    }
    const comparators = this.sort
      .map(item => this.comparatorFor(item))
      .filter(
        (comparator): comparator is TComparator<TRow, unknown> & { columnId: string } =>
          !isNil(comparator)
      );
    if (comparators.length === 0) {
      return rows;
    }
    return sortLeafRuns(rows, (left, right) => {
      for (const compare of comparators) {
        const column = this.kernel.columns.byId.get(compare.columnId);
        if (column === undefined) {
          continue;
        }
        const result = compare(column.value(left), column.value(right), left, right);
        if (result !== 0) {
          return result;
        }
      }
      return 0;
    });
  }

  private isUnsortable(columnId: string): boolean {
    return (
      this.kernel.columns.isService(columnId) ||
      this.kernel.columns.byId.get(columnId)?.sort === false
    );
  }

  private comparatorFor(
    item: ISortItem
  ): (TComparator<TRow, unknown> & { columnId: string }) | undefined {
    const column = this.kernel.columns.byId.get(item.columnId);
    if (column === undefined || column.sort === false) {
      return undefined;
    }
    const base: TComparator<TRow, unknown> =
      typeof column.sort === 'function'
        ? column.sort
        : (left, right) => compareByKind(column.kind, left, right);
    const sign = item.direction === 'asc' ? 1 : -1;
    return Object.assign(withNullsLast(base, sign), { columnId: item.columnId });
  }
}

/** Sorts each run of consecutive leaves in place of itself; group rows stay where they are. */
function sortLeafRuns<TRow>(
  rows: readonly TDisplayRow<TRow>[],
  compare: (left: TRow, right: TRow) => number
): readonly TDisplayRow<TRow>[] {
  const result: TDisplayRow<TRow>[] = [];
  let run: TDisplayRow<TRow>[] = [];
  const flush = (): void => {
    result.push(
      ...run.sort((left, right) =>
        left.kind === 'leaf' && right.kind === 'leaf' ? compare(left.row, right.row) : 0
      )
    );
    run = [];
  };
  for (const row of rows) {
    if (row.kind === 'leaf') {
      run.push(row);
      continue;
    }
    flush();
    result.push(row);
  }
  flush();
  return result;
}

export function sorting<TRow = never>(
  options: ISortingOptions = {}
): ITableExtension<TRow, 'sorting', ISortingSlice> {
  return {
    id: 'sorting',
    create(kernel): IExtensionInstance<TRow, ISortingSlice> {
      const slice = new SortingSlice(kernel, options);
      return {
        slice,
        query: () => ({ sort: slice.sort }),
        pipeline: { order: SORTING_STAGE_ORDER, apply: rows => slice.apply(rows) },
        menu: ({ target, columnId }) => {
          if (
            target !== 'header' ||
            columnId === undefined ||
            slice.reasonAgainst(columnId) !== undefined
          ) {
            return [];
          }
          const direction = slice.directionOf(columnId);
          const setTo = (next: TSortDirection): TMenuItem => ({
            id: `sorting.${next}`,
            label: `menu.sort.${next}`,
            section: 'sorting',
            disabled: direction === next,
            run: () => void slice.set([{ columnId, direction: next }]),
          });
          return [
            setTo('asc'),
            setTo('desc'),
            {
              id: 'sorting.clear',
              label: 'menu.sort.clear',
              section: 'sorting',
              disabled: direction === undefined,
              run: () => void slice.set(slice.sort.filter(item => item.columnId !== columnId)),
            },
          ];
        },
        state: {
          read: () => slice.sort,
          write: value => {
            if (Array.isArray(value)) {
              slice.set(value as readonly ISortItem[]);
            }
          },
          reset: () => slice.clear(),
        },
        dispose: () => undefined,
      };
    },
  };
}
