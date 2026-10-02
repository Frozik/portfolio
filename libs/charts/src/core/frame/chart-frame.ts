import type { IChartSize } from '../host/size-source';
import type { IDataFailure } from '../series/series-data';
import type { IStyledRun } from '../series/style-processor';
import type { IAxisDomain, IAxisRange, IValueRange } from '../viewport/axis-domain';
import type { IChartTheme } from './theme';

/** Device pixels from the top-left corner of the canvas. */
export interface IPlotRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ISeriesFrame<TX> {
  readonly id: string;
  readonly runs: readonly IStyledRun<TX>[];
}

/**
 * Everything a painter sees. The same object for as long as nothing in it
 * changed, so a painter tells "nothing to repaint" by reference, and grid,
 * axes, series and crosshair all read one mapping from data to pixels (§3.6).
 */
export interface IChartFrame<TX> {
  readonly domain: IAxisDomain<TX>;
  readonly x: IAxisRange<TX>;
  /** Length of `x` in axis units. */
  readonly xSpan: number;
  readonly y: IValueRange;
  readonly size: IChartSize;
  readonly plot: IPlotRect;
  readonly series: readonly ISeriesFrame<TX>[];
  readonly loading: readonly IAxisRange<TX>[];
  readonly failed: readonly IDataFailure<TX>[];
  readonly theme: IChartTheme;
}
