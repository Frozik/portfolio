import type { ISeriesFrame } from '../frame/chart-frame';
import type { IInsets } from '../frame/theme';
import type { IChartHost } from '../host/chart-host';
import type { TScaleKind } from '../scale/scale';
import type { IPaintContribution } from '../stage/backend';
import type { IAxisDomain, IAxisRange } from '../viewport/axis-domain';
import type { IChartKernel } from './kernel';

/** What is on screen this frame against one value scale, before the scale is fitted to it. */
export interface IVisibleData<TX> {
  readonly domain: IAxisDomain<TX>;
  readonly x: IAxisRange<TX>;
  readonly scaleKind: TScaleKind;
  /** The room the scale asks for beyond the data, as a share of its height; none of its own when it does not say. */
  readonly padding: number | undefined;
  /** The series measured against the scale. */
  readonly series: readonly ISeriesFrame<TX>[];
}

/** Everything an extension hands the kernel. Every field but the slice is optional; the kernel composes what is there (§3.5). */
export interface IExtensionInstance<TX, TSlice> {
  readonly slice: TSlice;
  /** A step before the frame is built: inertia, animation, timers. */
  tick?(now: number): void;
  /** Narrows an X range about to be written: bounds, a least span. */
  constrainX?(range: IAxisRange<TX>): IAxisRange<TX>;
  /** Moves what is drawn along an axis towards its target; without an animator the drawn range is the target. */
  animate?<T>(domain: IAxisDomain<T>, current: IAxisRange<T>, target: IAxisRange<T>): IAxisRange<T>;
  /** The range of a value scale that fits what is visible against it. */
  fitY?(visible: IVisibleData<TX>): IAxisRange<number> | undefined;
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
