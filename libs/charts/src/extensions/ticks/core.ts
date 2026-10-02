import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../core/frame/chart-frame';
import type { IAxisTick, ITickGenerator, ITicksSlice } from '../../core/frame/ticks';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IChartExtension } from '../../core/kernel/extension';
import type { IScaleFrame } from '../../core/scale/scale';
import { percentOf, valueOfPercent } from '../../core/scale/scale-mapping';
import { linearTicks } from './linear-ticks';
import { logTicks } from './log-ticks';

export interface ITicksOptions<TX> {
  readonly x: ITickGenerator<TX>;
  /** Ticks of the linear value scales; round numbers by default. */
  readonly y?: ITickGenerator<number>;
}

interface IFrameTicks<TX> {
  readonly x: readonly IAxisTick<TX>[];
  readonly values: Map<string, readonly IAxisTick<number>[]>;
}

function signed(label: string, percent: number): string {
  return `${percent > 0 ? '+' : ''}${label}%`;
}

/**
 * The ticks of the X axis and of every value scale, computed once per frame
 * and shared by whatever draws from them: a label names exactly the line
 * under it. The generators come as parameters, so a time axis and a numeric
 * one are the same extension; a logarithmic scale gets ticks by powers of
 * ten, and a scale labelled in per cent gets round percentages (§7.2).
 */
export function ticks<TX>(
  options: ITicksOptions<TX>
): IChartExtension<TX, typeof TICKS_EXTENSION, ITicksSlice<TX>> {
  const linear = options.y ?? linearTicks();
  const logarithmic = logTicks();

  return {
    id: TICKS_EXTENSION,
    create() {
      const byFrame = new WeakMap<IChartFrame<TX>, IFrameTicks<TX>>();
      const widthOf = (frame: IChartFrame<TX>): number =>
        frame.plot.width / frame.size.devicePixelRatio;
      const heightOf = (frame: IChartFrame<TX>, scale: IScaleFrame): number =>
        scale.plot.height / frame.size.devicePixelRatio;

      const ticksOf = (frame: IChartFrame<TX>): IFrameTicks<TX> => {
        let computed = byFrame.get(frame);
        if (isNil(computed)) {
          computed = { x: options.x.ticks(frame.x, widthOf(frame)), values: new Map() };
          byFrame.set(frame, computed);
        }
        return computed;
      };

      const valueTicksOf = (
        frame: IChartFrame<TX>,
        scale: IScaleFrame
      ): readonly IAxisTick<number>[] => {
        const lengthPx = heightOf(frame, scale);
        const { base } = scale;
        if (!isNil(base)) {
          const range = { start: percentOf(base, scale.min), end: percentOf(base, scale.max) };
          return linear.ticks(range, lengthPx).map(tick => ({
            position: valueOfPercent(base, tick.position),
            label: signed(tick.label, tick.position),
          }));
        }
        const generator = scale.kind === 'log' ? logarithmic : linear;
        const found = generator.ticks({ start: scale.min, end: scale.max }, lengthPx);
        const { format } = scale;
        return isNil(format)
          ? found
          : found.map(tick => ({ position: tick.position, label: format(tick.position) }));
      };

      return {
        slice: {
          xTicks: frame => ticksOf(frame).x,
          valueTicks(frame, scale): readonly IAxisTick<number>[] {
            const { values } = ticksOf(frame);
            let computed = values.get(scale.id);
            if (isNil(computed)) {
              computed = valueTicksOf(frame, scale);
              values.set(scale.id, computed);
            }
            return computed;
          },
          formatX: (frame, position) => options.x.format(position, frame.x, widthOf(frame)),
          formatValue(frame, scale, value): string {
            const lengthPx = heightOf(frame, scale);
            const { base } = scale;
            if (!isNil(base)) {
              const range = { start: percentOf(base, scale.min), end: percentOf(base, scale.max) };
              const percent = percentOf(base, value);
              return signed(linear.format(percent, range, lengthPx), percent);
            }
            if (!isNil(scale.format)) {
              return scale.format(value);
            }
            const generator = scale.kind === 'log' ? logarithmic : linear;
            return generator.format(value, { start: scale.min, end: scale.max }, lengthPx);
          },
        },
      };
    },
  };
}
