import type { IScaleFrame } from '../scale/scale';
import type { IChartFrame } from './chart-frame';

export interface IAxisTick<TPosition> {
  readonly position: TPosition;
  readonly label: string;
}

export interface ITickRange<TPosition> {
  readonly start: TPosition;
  readonly end: TPosition;
}

/** Where the ticks of one axis stand and what they are called; time and plain numbers are two of these (§7.2). */
export interface ITickGenerator<TPosition> {
  /** Ticks for a range drawn over `lengthPx` CSS pixels, thinned so their labels do not overlap. */
  ticks(range: ITickRange<TPosition>, lengthPx: number): readonly IAxisTick<TPosition>[];
  /** Any position of the range, written one step finer than the tick labels so neighbours still differ. */
  format(position: TPosition, range: ITickRange<TPosition>, lengthPx: number): string;
}

/** What the `ticks` extension offers the grid, the axes and the crosshair: the one set of ticks they all draw from. */
export interface ITicksSlice<TX> {
  xTicks(frame: IChartFrame<TX>): readonly IAxisTick<TX>[];
  /** The ticks of a value scale; their positions are values, whatever the labels say. */
  valueTicks(frame: IChartFrame<TX>, scale: IScaleFrame): readonly IAxisTick<number>[];
  formatX(frame: IChartFrame<TX>, position: TX): string;
  formatValue(frame: IChartFrame<TX>, scale: IScaleFrame, value: number): string;
}

export const TICKS_EXTENSION = 'ticks';
