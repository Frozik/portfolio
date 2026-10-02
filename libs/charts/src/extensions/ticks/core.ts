import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../core/frame/chart-frame';
import type { IAxisTick, ITickGenerator, ITicksSlice } from '../../core/frame/ticks';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IChartExtension } from '../../core/kernel/extension';
import { linearTicks } from './linear-ticks';

export interface ITicksOptions<TX> {
  readonly x: ITickGenerator<TX>;
  readonly y?: ITickGenerator<number>;
}

interface IFrameTicks<TX> {
  readonly x: readonly IAxisTick<TX>[];
  readonly y: readonly IAxisTick<number>[];
}

/**
 * The ticks of both axes, computed once per frame and shared by whatever
 * draws from them: a label names exactly the line under it. The generators
 * come as parameters, so a time axis and a numeric one are the same extension (§7.2).
 */
export function ticks<TX>(
  options: ITicksOptions<TX>
): IChartExtension<TX, typeof TICKS_EXTENSION, ITicksSlice<TX>> {
  const yGenerator = options.y ?? linearTicks();

  return {
    id: TICKS_EXTENSION,
    create() {
      const byFrame = new WeakMap<IChartFrame<TX>, IFrameTicks<TX>>();
      const widthOf = (frame: IChartFrame<TX>): number =>
        frame.plot.width / frame.size.devicePixelRatio;
      const heightOf = (frame: IChartFrame<TX>): number =>
        frame.plot.height / frame.size.devicePixelRatio;
      const yRange = (frame: IChartFrame<TX>) => ({ start: frame.y.min, end: frame.y.max });

      const ticksOf = (frame: IChartFrame<TX>): IFrameTicks<TX> => {
        let computed = byFrame.get(frame);
        if (isNil(computed)) {
          computed = {
            x: options.x.ticks(frame.x, widthOf(frame)),
            y: yGenerator.ticks(yRange(frame), heightOf(frame)),
          };
          byFrame.set(frame, computed);
        }
        return computed;
      };

      return {
        slice: {
          xTicks: frame => ticksOf(frame).x,
          yTicks: frame => ticksOf(frame).y,
          formatX: (frame, position) => options.x.format(position, frame.x, widthOf(frame)),
          formatY: (frame, value) => yGenerator.format(value, yRange(frame), heightOf(frame)),
        },
      };
    },
  };
}
