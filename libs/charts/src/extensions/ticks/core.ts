import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../core/frame/chart-frame';
import type {
  IAxisTick,
  ITickAxis,
  ITickGenerator,
  ITickRange,
  ITicksSlice,
} from '../../core/frame/ticks';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IChartExtension } from '../../core/kernel/extension';
import type { IScaleFrame } from '../../core/scale/scale';
import { fractionOf, percentOf, valueOfPercent } from '../../core/scale/scale-mapping';
import { spanOf } from '../../core/viewport/axis-domain';
import { toWorldRange } from '../../core/viewport/axis-mapping';
import { numberDomain } from '../../core/viewport/number-domain';
import { xToPixel } from '../../core/viewport/plot-mapping';
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
      /** The X axis in world coordinates, with the frame's cuts taken into account by the layout. */
      const xAxisOf = (frame: IChartFrame<TX>): ITickAxis<TX> => {
        const { domain, mapping } = frame;
        const toVirtual = (position: TX): TX => mapping?.toVirtual(position) ?? position;
        const range = isNil(mapping) ? frame.x : toWorldRange(mapping, frame.x);
        return {
          domain,
          range,
          lengthPx: (widthOf(frame) * spanOf(domain, range)) / frame.xSpan,
          pixelOf: position => xToPixel(frame, toVirtual(position)) / frame.size.devicePixelRatio,
          shownAt: position =>
            isNil(mapping) ? position : mapping.toWorld(mapping.toVirtual(position), 'after'),
        };
      };
      const xTicksOf = (frame: IChartFrame<TX>): readonly IAxisTick<TX>[] => {
        const { mapping } = frame;
        const found = options.x.ticks(xAxisOf(frame));
        return isNil(mapping)
          ? found
          : found.map(tick => ({ ...tick, position: mapping.toVirtual(tick.position) }));
      };
      /** A value scale as an axis of ticks; `valueOf` says what a tick position is worth, for scales labelled in per cent. */
      const valueAxisOf = (
        frame: IChartFrame<TX>,
        scale: IScaleFrame,
        range: ITickRange<number>,
        valueOf: (position: number) => number = position => position
      ): ITickAxis<number> => ({
        domain: numberDomain,
        range,
        lengthPx: heightOf(frame, scale),
        pixelOf: position => fractionOf(scale, valueOf(position)) * heightOf(frame, scale),
        shownAt: position => position,
      });

      const ticksOf = (frame: IChartFrame<TX>): IFrameTicks<TX> => {
        let computed = byFrame.get(frame);
        if (isNil(computed)) {
          computed = { x: xTicksOf(frame), values: new Map() };
          byFrame.set(frame, computed);
        }
        return computed;
      };

      const valueTicksOf = (
        frame: IChartFrame<TX>,
        scale: IScaleFrame
      ): readonly IAxisTick<number>[] => {
        const { base } = scale;
        if (!isNil(base)) {
          const range = { start: percentOf(base, scale.min), end: percentOf(base, scale.max) };
          const percentAxis = valueAxisOf(frame, scale, range, percent =>
            valueOfPercent(base, percent)
          );
          return linear.ticks(percentAxis).map(tick => ({
            position: valueOfPercent(base, tick.position),
            label: signed(tick.label, tick.position),
          }));
        }
        const generator = scale.kind === 'log' ? logarithmic : linear;
        const found = generator.ticks(
          valueAxisOf(frame, scale, { start: scale.min, end: scale.max })
        );
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
          formatX: (frame, position, edge = 'after') =>
            options.x.format(frame.mapping?.toWorld(position, edge) ?? position, xAxisOf(frame)),
          formatValue(frame, scale, value): string {
            const { base } = scale;
            if (!isNil(base)) {
              const range = { start: percentOf(base, scale.min), end: percentOf(base, scale.max) };
              const percent = percentOf(base, value);
              return signed(linear.format(percent, valueAxisOf(frame, scale, range)), percent);
            }
            if (!isNil(scale.format)) {
              return scale.format(value);
            }
            const generator = scale.kind === 'log' ? logarithmic : linear;
            return generator.format(
              value,
              valueAxisOf(frame, scale, { start: scale.min, end: scale.max })
            );
          },
        },
      };
    },
  };
}
