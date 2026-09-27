import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { TAnyColumn } from '../../core/columns/column';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TDisplayRow } from '../../core/rows/display-row';
import type { IQuickFilter } from '../../core/rows/row-query';
import { EMPTY_QUERY } from '../../core/rows/row-query';
import type {
  IFilterChange,
  IFilteringOptions,
  IFilteringSlice,
  IFilteringState,
} from './contracts';
import { filteringMenu } from './menu';
import type { TFilterModel } from './model';
import { isEmptyFilterModel } from './model';
import { compileQuickFilter, isQuickFilterColumn, quickFilterText } from './quick-filter';
import type { TAnyFilterSpec, TPredicate } from './spec';
import { toInstant } from './specs/date';
import { resolveColumnFilter } from './specs/default';
import { valueModelFor } from './value-model';

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'filtering.set': { readonly columnId: string; readonly model: TFilterModel | null };
    readonly 'filtering.quick': { readonly quick: IQuickFilter };
    readonly 'filtering.extra': { readonly name: string; readonly value: unknown };
    readonly 'filtering.clear': Record<string, never>;
  }
  interface ITableEvents {
    readonly 'filtering.changed': {
      readonly filters: Readonly<Record<string, TFilterModel>>;
      readonly quick: IQuickFilter;
      readonly extra: Readonly<Record<string, unknown>>;
    };
  }
}

export const FILTERING_STAGE_ORDER = 100;

interface IColumnPredicate<TRow> {
  readonly column: TAnyColumn<TRow>;
  readonly test: TPredicate<unknown, unknown>;
}

class FilteringSlice<TRow> implements IFilteringSlice {
  filters: Readonly<Record<string, TFilterModel>> = {};
  quick: IQuickFilter = EMPTY_QUERY.quick;
  extra: Readonly<Record<string, unknown>> = {};
  filterRow: boolean;
  private readonly onFilterChange: ((change: IFilterChange) => void) | undefined;
  private readonly seen = new Map<string, Map<string, unknown>>();
  private textCache = new WeakMap<object, string>();
  private textCacheColumns: readonly TAnyColumn<TRow>[] | undefined = undefined;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IFilteringOptions
  ) {
    this.filterRow = options.filterRow ?? false;
    this.onFilterChange = options.onFilterChange;
    makeAutoObservable<
      FilteringSlice<TRow>,
      | 'kernel'
      | 'onFilterChange'
      | 'seen'
      | 'textCache'
      | 'textCacheColumns'
      | 'rowText'
      | 'remember'
    >(
      this,
      {
        kernel: false,
        onFilterChange: false,
        seen: false,
        textCache: false,
        textCacheColumns: false,
        specOf: false,
        modelOf: false,
        reasonAgainst: false,
        valuesSeen: false,
        filterFor: false,
        apply: false,
        rowText: false,
        remember: false,
        readState: false,
      },
      { autoBind: true }
    );
  }

  get quickInvalid(): boolean {
    return compileQuickFilter(this.quick) === undefined;
  }

  get activeCount(): number {
    return Object.keys(this.filters).length + (this.quick.text.trim() === '' ? 0 : 1);
  }

  private get specs(): ReadonlyMap<string, TAnyFilterSpec> {
    const specs = new Map<string, TAnyFilterSpec>();
    for (const column of this.kernel.columns.all) {
      const spec = this.kernel.columns.isService(column.id)
        ? undefined
        : resolveColumnFilter(column);
      if (spec !== undefined) {
        specs.set(column.id, spec);
      }
    }
    return specs;
  }

  private get predicates(): readonly IColumnPredicate<TRow>[] {
    return Object.entries(this.filters).flatMap(([columnId, model]) => {
      const column = this.kernel.columns.byId.get(columnId);
      const spec = this.specs.get(columnId);
      if (column === undefined || spec === undefined || spec.kind !== model.kind) {
        return [];
      }
      return [{ column, test: (spec as TAnyFilterSpec).predicate(model as never) }];
    });
  }

  private get quickColumns(): readonly TAnyColumn<TRow>[] {
    return this.kernel.columns.all.filter(
      column => isQuickFilterColumn(column) && !this.kernel.columns.isService(column.id)
    );
  }

  private get accumulatingColumns(): readonly TAnyColumn<TRow>[] {
    return [...this.specs]
      .filter(
        ([, spec]) =>
          spec.kind === 'set' &&
          (spec.options as { readonly values?: unknown }).values === 'accumulate'
      )
      .flatMap(([columnId]) => this.kernel.columns.byId.get(columnId) ?? []);
  }

  specOf(columnId: string): TAnyFilterSpec | undefined {
    return this.specs.get(columnId);
  }

  modelOf(columnId: string): TFilterModel | undefined {
    return this.filters[columnId];
  }

  reasonAgainst(columnId: string): string | undefined {
    const spec = this.specs.get(columnId);
    if (spec === undefined) {
      return 'filtering.notFilterable';
    }
    if (spec.readOnly === true) {
      return 'filtering.readOnly';
    }
    return this.kernel.commands.reasonAgainst('filtering.set', { columnId, model: null });
  }

  valuesSeen(columnId: string): readonly unknown[] {
    if (this.kernel.rows.rowCount === undefined) {
      return [];
    }
    return [...(this.seen.get(columnId)?.values() ?? [])];
  }

  filterFor(columnId: string, value: unknown): TFilterModel | undefined {
    const spec = this.specs.get(columnId);
    return spec === undefined ? undefined : valueModelFor(spec, value, toInstant);
  }

  set(columnId: string, model: TFilterModel | null): TCommandOutcome {
    const reason = this.reasonAgainst(columnId);
    if (reason !== undefined) {
      return { ok: false, reason };
    }
    const next = model === null || isEmptyFilterModel(model) ? undefined : model;
    return this.kernel.commands.run('filtering.set', { columnId, model: next ?? null }, () => {
      const previous = this.filters[columnId];
      const { [columnId]: removed, ...rest } = this.filters;
      this.filters = next === undefined ? rest : { ...rest, [columnId]: next };
      this.onFilterChange?.({ columnId, previous: previous ?? removed, next });
      this.emitChanged();
    });
  }

  clear(): TCommandOutcome {
    return this.kernel.commands.run('filtering.clear', {}, () => {
      this.filters = {};
      this.quick = EMPTY_QUERY.quick;
      this.emitChanged();
    });
  }

  setQuick(quick: Partial<IQuickFilter>): TCommandOutcome {
    const next = { ...this.quick, ...quick };
    return this.kernel.commands.run('filtering.quick', { quick: next }, () => {
      this.quick = next;
      this.emitChanged();
    });
  }

  setExtra(name: string, value: unknown): TCommandOutcome {
    return this.kernel.commands.run('filtering.extra', { name, value }, () => {
      const { [name]: removed, ...rest } = this.extra;
      this.extra = isNil(value) ? rest : { ...rest, [name]: value };
      this.emitChanged();
    });
  }

  setFilterRow(visible: boolean): void {
    this.filterRow = visible;
  }

  readState(): IFilteringState {
    return {
      filters: this.filters,
      quick: this.quick,
      extra: this.extra,
      filterRow: this.filterRow,
    };
  }

  writeState(state: Partial<IFilteringState>): void {
    this.filters = state.filters ?? {};
    this.quick = state.quick ?? EMPTY_QUERY.quick;
    this.extra = state.extra ?? {};
    this.filterRow = state.filterRow ?? this.filterRow;
    this.emitChanged();
  }

  apply(rows: readonly TDisplayRow<TRow>[]): readonly TDisplayRow<TRow>[] {
    const accumulating = this.accumulatingColumns;
    if (accumulating.length > 0) {
      this.remember(rows, accumulating);
    }
    const predicates = this.predicates;
    const matcher = compileQuickFilter(this.quick);
    const quickColumns = this.quickColumns;
    if (predicates.length === 0 && (matcher === undefined || this.quick.text.trim() === '')) {
      return rows;
    }
    return rows.filter(displayRow => {
      if (displayRow.kind !== 'leaf') {
        return true;
      }
      const { row } = displayRow;
      const passesColumns = predicates.every(({ column, test }) => test(column.value(row), row));
      return passesColumns && (matcher === undefined || matcher(this.rowText(row, quickColumns)));
    });
  }

  private remember(rows: readonly TDisplayRow<TRow>[], columns: readonly TAnyColumn<TRow>[]): void {
    for (const column of columns) {
      const values = this.seen.get(column.id) ?? new Map<string, unknown>();
      this.seen.set(column.id, values);
      for (const displayRow of rows) {
        if (displayRow.kind !== 'leaf') {
          continue;
        }
        const value = column.value(displayRow.row);
        const key = isNil(value) ? '' : String(value);
        if (!values.has(key)) {
          values.set(key, value);
        }
      }
    }
  }

  private rowText(row: TRow, columns: readonly TAnyColumn<TRow>[]): string {
    if (this.textCacheColumns !== columns) {
      this.textCache = new WeakMap();
      this.textCacheColumns = columns;
    }
    if (typeof row !== 'object' || row === null) {
      return quickFilterText(row, columns);
    }
    const cached = this.textCache.get(row);
    if (cached !== undefined) {
      return cached;
    }
    const text = quickFilterText(row, columns);
    this.textCache.set(row, text);
    return text;
  }

  private emitChanged(): void {
    this.kernel.events.emit('filtering.changed', {
      filters: this.filters,
      quick: this.quick,
      extra: this.extra,
    });
  }
}

export function filtering<TRow = never>(
  options: IFilteringOptions = {}
): ITableExtension<TRow, 'filtering', IFilteringSlice> {
  return {
    id: 'filtering',
    create(kernel): IExtensionInstance<TRow, IFilteringSlice> {
      const slice = new FilteringSlice(kernel, options);
      return {
        slice,
        query: () => ({ filters: slice.filters, quick: slice.quick, extra: slice.extra }),
        pipeline: { order: FILTERING_STAGE_ORDER, apply: rows => slice.apply(rows) },
        menu: context => filteringMenu(slice, kernel, context),
        state: {
          read: () => slice.readState(),
          write: value => slice.writeState(value as Partial<IFilteringState>),
          reset: () => slice.writeState({}),
        },
        dispose: () => undefined,
      };
    },
  };
}
