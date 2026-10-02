import type { ISeriesFrame } from '../frame/chart-frame';
import type { IInsets } from '../frame/theme';
import type { IChartHost } from '../host/chart-host';
import type { IPaintContribution } from '../stage/backend';
import type { IAxisDomain, IAxisRange, IValueRange } from '../viewport/axis-domain';
import type { IChartKernel } from './kernel';

/** What is on screen this frame, before the value axis is fitted to it. */
export interface IVisibleData<TX> {
  readonly domain: IAxisDomain<TX>;
  readonly x: IAxisRange<TX>;
  readonly series: readonly ISeriesFrame<TX>[];
}

/** Everything an extension hands the kernel. Every field but the slice is optional; the kernel composes what is there (§3.5). */
export interface IExtensionInstance<TX, TSlice> {
  readonly slice: TSlice;
  /** A step before the frame is built: inertia, animation, timers. */
  tick?(now: number): void;
  /** Narrows an X range about to be written: bounds, a least span. */
  constrainX?(range: IAxisRange<TX>): IAxisRange<TX>;
  /** Moves what is drawn towards the target; without an animator the drawn range is the target. */
  animate?(current: IAxisRange<TX>, target: IAxisRange<TX>): IAxisRange<TX>;
  /** The value range that fits what is visible. */
  fitY?(visible: IVisibleData<TX>): IValueRange | undefined;
  /** Room taken round the plot, CSS pixels. */
  insets?(): IInsets;
  readonly paint?: readonly IPaintContribution[];
  /** Called when the chart is mounted; returns the teardown. */
  mount?(host: IChartHost): VoidFunction;
  dispose?(): void;
}

export interface IChartExtension<TX, TId extends string = string, TSlice = unknown> {
  readonly id: TId;
  readonly requires?: readonly string[];
  create(kernel: IChartKernel<TX>): IExtensionInstance<TX, TSlice>;
}
