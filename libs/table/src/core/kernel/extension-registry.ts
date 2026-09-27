import { observable, runInAction } from 'mobx';

import { assert } from '@frozik/utils/assert/assert';
import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';

import type { TAnyColumn } from '../columns/column';
import type { TDisplayRow } from '../rows/display-row';
import type { IPipelineStage } from '../rows/pipeline';
import { orderStages } from '../rows/pipeline';
import type { IRowQuery } from '../rows/row-query';
import { mergeQuery } from '../rows/row-query';
import type { CommandBus } from './command-bus';
import type { ITableCommands } from './contracts';
import type { IExtensionInstance, IKeyBinding, ITableExtension } from './extension';
import type { ITableKernel } from './kernel';
import type { IMenuContext, TMenuItem } from './menu';

/**
 * Extensions register one after another while the model is built, and a
 * computed evaluated in between (a view reaction, for instance) must learn
 * about the ones registered after it ran — every query below reads
 * `generation`, which each registration bumps.
 */
export class ExtensionRegistry<TRow> {
  private readonly instances = new Map<string, IExtensionInstance<TRow, unknown>>();
  private readonly generation = observable.box(0);
  private readonly guardDisposers = new DisposableBag();

  constructor(private readonly commands: CommandBus<ITableCommands>) {}

  register(extension: ITableExtension<TRow>, kernel: ITableKernel<TRow, unknown>): void {
    assert(!this.instances.has(extension.id), `Extension "${extension.id}" is registered twice`);
    for (const required of extension.requires ?? []) {
      assert(this.instances.has(required), `Extension "${extension.id}" requires "${required}"`);
    }
    const instance = extension.create(kernel);
    this.instances.set(extension.id, instance);
    runInAction(() => this.generation.set(this.generation.get() + 1));
    if (instance.guards !== undefined) {
      this.guardDisposers.add(this.commands.guardAll(instance.guards));
    }
  }

  slice<TSlice>(id: string): TSlice | undefined {
    this.generation.get();
    return this.instances.get(id)?.slice as TSlice | undefined;
  }

  get ids(): readonly string[] {
    return [...this.instances.keys()];
  }

  get pipeline(): readonly IPipelineStage<TRow>[] {
    return orderStages(this.collect(instance => instance.pipeline));
  }

  query(): IRowQuery {
    return mergeQuery(this.collect(instance => instance.query?.()));
  }

  get serviceColumns(): readonly TAnyColumn<TRow>[] {
    return this.collect(instance => instance.columns).flat();
  }

  /** Called once per row on every height pass: only the instances that claim extents are asked, without allocating. */
  rowExtent(rowKey: string): number {
    const extents = this.extentInstances;
    let sum = 0;
    for (const instance of extents) {
      sum += instance.rowExtent?.(rowKey) ?? 0;
    }
    return sum;
  }

  private extentCache:
    | {
        readonly generation: number;
        readonly instances: readonly IExtensionInstance<TRow, unknown>[];
      }
    | undefined = undefined;

  private get extentInstances(): readonly IExtensionInstance<TRow, unknown>[] {
    const generation = this.generation.get();
    if (this.extentCache?.generation !== generation) {
      this.extentCache = {
        generation,
        instances: [...this.instances.values()].filter(
          instance => instance.rowExtent !== undefined
        ),
      };
    }
    return this.extentCache.instances;
  }

  pinnedRows(side: 'top' | 'bottom'): readonly TDisplayRow<TRow>[] {
    return this.collect(instance => instance.pinnedRows?.(side)).flat();
  }

  get keys(): readonly IKeyBinding<TRow>[] {
    return this.collect(instance => instance.keys).flat();
  }

  menu(context: IMenuContext<TRow>): readonly TMenuItem[] {
    return this.collect(instance => instance.menu?.(context)).flat();
  }

  get views(): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
    const views = new Map<string, Readonly<Record<string, unknown>>>();
    for (const [id, instance] of this.instances) {
      if (instance.view !== undefined) {
        views.set(id, instance.view);
      }
    }
    return views;
  }

  get overrides(): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
    const overrides = new Map<string, Readonly<Record<string, unknown>>>();
    for (const [id, instance] of this.instances) {
      if (instance.overrides !== undefined) {
        overrides.set(id, instance.overrides);
      }
    }
    return overrides;
  }

  readState(): Readonly<Record<string, unknown>> {
    const state: Record<string, unknown> = {};
    for (const [id, instance] of this.instances) {
      if (instance.state !== undefined) {
        state[id] = instance.state.read();
      }
    }
    return state;
  }

  writeState(state: Readonly<Record<string, unknown>>): void {
    for (const [id, instance] of this.instances) {
      const value = state[id];
      if (instance.state !== undefined && value !== undefined) {
        instance.state.write(value);
      }
    }
  }

  resetState(): void {
    for (const instance of this.instances.values()) {
      instance.state?.reset();
    }
  }

  dispose(): void {
    this.guardDisposers.disposeAll();
    for (const instance of [...this.instances.values()].reverse()) {
      instance.dispose();
    }
    this.instances.clear();
    runInAction(() => this.generation.set(this.generation.get() + 1));
  }

  private collect<TItem>(
    pick: (instance: IExtensionInstance<TRow, unknown>) => TItem | undefined
  ): readonly TItem[] {
    this.generation.get();
    const items: TItem[] = [];
    for (const instance of this.instances.values()) {
      const item = pick(instance);
      if (item !== undefined) {
        items.push(item);
      }
    }
    return items;
  }
}
