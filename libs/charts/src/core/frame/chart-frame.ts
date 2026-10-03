import { isNil } from 'lodash-es';

import type { IChartSize } from '../host/size-source';
import type { IPaneFrame, IScaleFrame } from '../scale/scale';
import type { IDataFailure } from '../series/series-data';
import type { IStyledRun } from '../series/style-processor';
import type { IAxisDomain, IAxisRange } from '../viewport/axis-domain';
import type { IAxisMapping } from '../viewport/axis-mapping';
import type { IPlotRect } from './plot-rect';
import type { IChartTheme } from './theme';

export interface ISeriesFrame<TX> {
  readonly id: string;
  /** What the series is called in a legend; its id when it has no name. */
  readonly name: string;
  /** The value scale the series is measured against. */
  readonly scaleId: string;
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
  /** The cuts of the axis, for whatever shows world positions; none while the axis is shown whole. */
  readonly mapping: IAxisMapping<TX> | undefined;
  readonly size: IChartSize;
  /** The whole plot: every pane together. */
  readonly plot: IPlotRect;
  /** The panes top to bottom; a chart that names none has one. */
  readonly panes: readonly IPaneFrame[];
  readonly series: readonly ISeriesFrame<TX>[];
  readonly loading: readonly IAxisRange<TX>[];
  readonly failed: readonly IDataFailure<TX>[];
  readonly theme: IChartTheme;
}

/** The scale of the given id; a frame is only ever asked for scales its chart has. */
export function scaleOf<TX>(frame: IChartFrame<TX>, scaleId: string): IScaleFrame {
  for (const pane of frame.panes) {
    const scale = pane.scales.find(candidate => candidate.id === scaleId);
    if (!isNil(scale)) {
      return scale;
    }
  }
  throw new Error(`the frame has no value scale "${scaleId}"`);
}

/** The first scale of the first pane: what a chart with one scale means by "the value axis". */
export function mainScaleOf<TX>(frame: IChartFrame<TX>): IScaleFrame {
  return frame.panes[0].scales[0];
}
