import { isNil } from 'lodash-es';
import { makeAutoObservable, reaction } from 'mobx';

import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';

import type { TAnyColumn } from './columns/column';
import { ColumnsModel } from './columns/columns-model';
import { FocusModel } from './focus/focus-model';
import type { TBivariantCallback } from './kernel/callback';
import { CommandBus } from './kernel/command-bus';
import type { ITableCommands, ITableEvents } from './kernel/contracts';
import { EventBus } from './kernel/event-bus';
import type { IKeyBinding } from './kernel/extension';
import { ExtensionRegistry } from './kernel/extension-registry';
import type { ITableKernel } from './kernel/kernel';
import type { IMenuContext, TMenuItem } from './kernel/menu';
import type { TDisplayRow } from './rows/display-row';
import { leafRow } from './rows/display-row';
import type { IPipelineStage } from './rows/pipeline';
import type { IRowChange } from './rows/row-change';
import { resolveRowKey } from './rows/row-key';
import type { IRowQuery } from './rows/row-query';
import type { IRowSource } from './rows/row-source';
import type { ITableState } from './state/table-state';
import type { ITableOptions, TAnyExtension } from './table-options';

type TPinnedRows<TRow> = ITableOptions<TRow, unknown, readonly TAnyExtension<TRow>[]>['pinnedRows'];

/**
 * The kernel: columns, rows, focus, state and the extension registry, wired
 * together. Extensions receive it as `ITableKernel`; the application receives
 * it as the model, with every extension slice attached by id.
 */
export class TableModel<TRow, TContext> implements ITableKernel<TRow, TContext> {
  readonly id: string | undefined;
  readonly events = new EventBus<ITableEvents>();
  readonly commands = new CommandBus<ITableCommands>();
  readonly columns: ColumnsModel<TRow>;
  readonly focus: FocusModel<TRow>;
  readonly context: TContext;
  ready: boolean;
  disposed = false;

  private readonly registry: ExtensionRegistry<TRow>;
  private readonly source: IRowSource<TRow>;
  private readonly keyOf: TBivariantCallback<[row: TRow], string>;
  private readonly pinnedRows: TPinnedRows<TRow>;
  private readonly onRowsChange:
    | TBivariantCallback<[changes: readonly IRowChange<TRow>[]], void | Promise<void>>
    | undefined;
  private readonly onSourceError: ((error: unknown) => void) | undefined;
  private readonly disposers = new DisposableBag();

  constructor(options: ITableOptions<TRow, TContext, readonly TAnyExtension<TRow>[]>) {
    this.id = options.id;
    this.context = options.context;
    this.ready = options.ready ?? true;
    this.keyOf = resolveRowKey(options.rowKey);
    this.pinnedRows = options.pinnedRows;
    this.onRowsChange = options.onRowsChange?.bind(options);
    this.onSourceError = options.onSourceError?.bind(options);
    this.columns = new ColumnsModel(options.columns, this.commands, this.events);
    this.registry = new ExtensionRegistry(this.commands);
    this.focus = new FocusModel(this.columns, () => this.source);
    makeAutoObservable<
      TableModel<TRow, TContext>,
      | 'registry'
      | 'source'
      | 'keyOf'
      | 'pinnedRows'
      | 'onRowsChange'
      | 'onSourceError'
      | 'disposers'
    >(
      this,
      {
        id: false,
        disposed: false,
        events: false,
        commands: false,
        registry: false,
        source: false,
        keyOf: false,
        pinnedRows: false,
        onRowsChange: false,
        onSourceError: false,
        disposers: false,
        rowKey: false,
        extension: false,
        rowExtent: false,
        menu: false,
        changeRows: false,
        reportSourceError: false,
      },
      { autoBind: true }
    );
    const registry = this.registry;
    this.source = options.rows({
      rowKey: this.keyOf,
      get pipeline() {
        return registry.pipeline;
      },
      reportError: error => this.reportSourceError(error),
      guard: (command, guard) => this.commands.guard(command, guard),
    });
    for (const extension of options.extensions) {
      this.registry.register(extension, this);
    }
    this.columns.setServiceColumns(this.registry.serviceColumns);
    this.disposers.add(() => this.source.dispose());
    this.disposers.add(
      reaction(
        () => (this.ready ? this.query : undefined),
        query => query !== undefined && this.source.setQuery(query),
        { fireImmediately: true }
      )
    );
    if (!isNil(options.initialState)) {
      this.applyState(options.initialState);
    }
  }

  get rows(): IRowSource<TRow> {
    return this.source;
  }

  get pipeline(): readonly IPipelineStage<TRow>[] {
    return this.registry.pipeline;
  }

  get keys(): readonly IKeyBinding<TRow>[] {
    return this.registry.keys;
  }

  get query(): IRowQuery {
    return this.registry.query();
  }

  get pinnedTop(): readonly TDisplayRow<TRow>[] {
    const own = (this.pinnedRows?.top?.() ?? []).map(row => leafRow(this.keyOf(row), row));
    return [...own, ...this.registry.pinnedRows('top')];
  }

  get pinnedBottom(): readonly TDisplayRow<TRow>[] {
    const own = (this.pinnedRows?.bottom?.() ?? []).map(row => leafRow(this.keyOf(row), row));
    return [...own, ...this.registry.pinnedRows('bottom')];
  }

  get state(): ITableState {
    return { columns: this.columns.state, extensions: this.registry.readState() };
  }

  rowKey(row: TRow): string {
    return this.keyOf(row);
  }

  extension<TSlice>(id: string): TSlice | undefined {
    return this.registry.slice<TSlice>(id);
  }

  rowExtent(rowKey: string): number {
    return this.registry.rowExtent(rowKey);
  }

  menu(context: IMenuContext<TRow>): readonly TMenuItem[] {
    return this.registry.menu(context);
  }

  /** View contributions by extension id, in registration order; the view adapter types them. */
  get views(): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
    return this.registry.views;
  }

  get overrides(): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
    return this.registry.overrides;
  }

  setReady(ready: boolean): void {
    this.ready = ready;
  }

  setColumns(columns: readonly TAnyColumn<TRow>[]): void {
    this.columns.setDefinitions(columns);
  }

  applyState(state: Partial<ITableState>): void {
    this.commands.run('state.apply', {}, () => {
      if (!isNil(state.columns)) {
        this.columns.applyState(state.columns);
      }
      if (!isNil(state.extensions)) {
        this.registry.writeState(state.extensions);
      }
      this.events.emit('state.changed', undefined);
    });
  }

  resetState(): void {
    this.commands.run('state.reset', {}, () => {
      this.columns.reset();
      this.registry.resetState();
      this.events.emit('state.changed', undefined);
    });
  }

  changeRows(changes: readonly IRowChange<TRow>[]): void | Promise<void> {
    return this.onRowsChange?.(changes);
  }

  reportSourceError(error: unknown): void {
    this.onSourceError?.(error);
  }

  dispose(): void {
    this.disposed = true;
    this.disposers.disposeAll();
    this.registry.dispose();
    this.commands.clear();
    this.events.clear();
  }
}
