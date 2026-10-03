import type { IScaleFrame } from '../scale/scale';
import type { IAxisDomain } from '../viewport/axis-domain';
import type { TCutEdge } from '../viewport/axis-mapping';
import type { IChartFrame } from './chart-frame';

export interface IAxisTick<TPosition> {
  readonly position: TPosition;
  readonly label: string;
}

export interface ITickRange<TPosition> {
  readonly start: TPosition;
  readonly end: TPosition;
}

/**
 * The axis ticks are made for, in world coordinates: a generator puts its
 * candidates on round values and leaves where they fall, and whether a cut
 * swallowed them, to the axis.
 */
export interface ITickAxis<TPosition> {
  readonly domain: IAxisDomain<TPosition>;
  readonly range: ITickRange<TPosition>;
  /** CSS pixels the range would take shown whole: what a step of the ticks is chosen by. */
  readonly lengthPx: number;
  /** Where a position falls along the axis, CSS pixels. */
  pixelOf(position: TPosition): number;
  /** Where a tick at the position stands: the position itself, or the edge of the cut it fell into. */
  shownAt(position: TPosition): TPosition;
}

/** Where the ticks of one axis stand and what they are called; time and plain numbers are two of these (§7.2). */
export interface ITickGenerator<TPosition> {
  /** Ticks for the axis, thinned so their labels do not overlap. */
  ticks(axis: ITickAxis<TPosition>): readonly IAxisTick<TPosition>[];
  /** Any position of the axis, written one step finer than the tick labels so neighbours still differ. */
  format(position: TPosition, axis: ITickAxis<TPosition>): string;
}

/** What the `ticks` extension offers the grid, the axes and the crosshair: the one set of ticks they all draw from. */
export interface ITicksSlice<TX> {
  /** The ticks of the X axis, where the frame draws them. */
  xTicks(frame: IChartFrame<TX>): readonly IAxisTick<TX>[];
  /** The ticks of a value scale; their positions are values, whatever the labels say. */
  valueTicks(frame: IChartFrame<TX>, scale: IScaleFrame): readonly IAxisTick<number>[];
  /** A position of the frame written as the world position it shows; on a cut, the edge asked for. */
  formatX(frame: IChartFrame<TX>, position: TX, edge?: TCutEdge): string;
  formatValue(frame: IChartFrame<TX>, scale: IScaleFrame, value: number): string;
}

export const TICKS_EXTENSION = 'ticks';
