import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { IInsets } from '../frame/theme';
import { addInsets, NO_INSETS } from '../frame/theme';
import type { IChartHost } from '../host/chart-host';
import type { IPaintContribution } from '../stage/backend';
import type { IAxisDomain, IAxisRange } from '../viewport/axis-domain';
import type { IChartExtension, IExtensionInstance, IVisibleData } from './extension';
import type { IChartKernel } from './kernel';

type TInstance<TX> = IExtensionInstance<TX, unknown>;

/** The extensions of one chart, in registration order, with their contributions gathered by kind. */
export class ExtensionRegistry<TX> {
  private readonly instances = new Map<string, TInstance<TX>>();
  private tickers: readonly TInstance<TX>[] = [];
  private constrainers: readonly TInstance<TX>[] = [];
  private fitters: readonly TInstance<TX>[] = [];
  private insetters: readonly TInstance<TX>[] = [];
  private animator: TInstance<TX> | undefined;

  register(extension: IChartExtension<TX>, kernel: IChartKernel<TX>): void {
    assert(!this.instances.has(extension.id), `extension "${extension.id}" is registered twice`);
    for (const required of extension.requires ?? []) {
      assert(this.instances.has(required), `extension "${extension.id}" requires "${required}"`);
    }
    const instance = extension.create(kernel);
    assert(
      isNil(instance.animate) || isNil(this.animator),
      `extension "${extension.id}" animates the viewport, and another one already does`
    );
    this.instances.set(extension.id, instance);
    const all = [...this.instances.values()];
    this.tickers = all.filter(each => !isNil(each.tick));
    this.constrainers = all.filter(each => !isNil(each.constrainX));
    this.fitters = all.filter(each => !isNil(each.fitY));
    this.insetters = all.filter(each => !isNil(each.insets));
    this.animator = all.find(each => !isNil(each.animate));
  }

  slice<TSlice>(id: string): TSlice | undefined {
    return this.instances.get(id)?.slice as TSlice | undefined;
  }

  get paint(): readonly IPaintContribution[] {
    return [...this.instances.values()].flatMap(instance => instance.paint ?? []);
  }

  tick(now: number): void {
    for (const instance of this.tickers) {
      instance.tick?.(now);
    }
  }

  constrainX(range: IAxisRange<TX>): IAxisRange<TX> {
    return this.constrainers.reduce(
      (constrained, instance) => instance.constrainX?.(constrained) ?? constrained,
      range
    );
  }

  /** Where the drawn range of an axis goes this frame: towards the target, or straight to it when nothing animates. */
  animate<T>(domain: IAxisDomain<T>, current: IAxisRange<T>, target: IAxisRange<T>): IAxisRange<T> {
    return this.animator?.animate?.(domain, current, target) ?? target;
  }

  fitY(visible: IVisibleData<TX>): IAxisRange<number> | undefined {
    for (const instance of this.fitters) {
      const fitted = instance.fitY?.(visible);
      if (!isNil(fitted)) {
        return fitted;
      }
    }
    return undefined;
  }

  insets(): IInsets {
    return this.insetters.reduce(
      (total, instance) => addInsets(total, instance.insets?.() ?? NO_INSETS),
      NO_INSETS
    );
  }

  mount(host: IChartHost): VoidFunction {
    const unmounts = [...this.instances.values()].flatMap(instance => instance.mount?.(host) ?? []);
    return () => {
      for (const unmount of unmounts.reverse()) {
        unmount();
      }
    };
  }

  dispose(): void {
    for (const instance of [...this.instances.values()].reverse()) {
      instance.dispose?.();
    }
    this.instances.clear();
  }
}
