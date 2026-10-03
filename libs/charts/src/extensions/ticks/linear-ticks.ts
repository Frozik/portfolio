import type { IAxisTick, ITickGenerator } from '../../core/frame/ticks';
import { laidOut } from './laid-out';

/** Base nice multipliers — scaled by powers of 10 to cover any range. */
const NICE_BASES = [1, 2, 5] as const;
const TARGET_TICK_COUNT = 8;
const MIN_TICK_COUNT = 2;
const DEGENERATE_RANGE_DECIMALS = 1;
const DEFAULT_LABEL_SIZE_PX = 20;
const MIN_LABEL_GAP_PX = 10;
const STEP_TOLERANCE = 0.01;
const DECIMAL = 10;

export interface ILinearTicksOptions {
  /** Room one label takes along the axis, CSS pixels: its height on a value axis, its width on an X axis. */
  readonly labelSizePx?: number;
}

/** A step close to `roughStep` of the form 1, 2 or 5 × 10ⁿ, whatever the magnitude. */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) {
    return 1;
  }
  const magnitude = DECIMAL ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const base = NICE_BASES.find(candidate => candidate >= normalized);
  return (base ?? DECIMAL) * magnitude;
}

function stepOf(range: number): number {
  const step = niceStep(range / TARGET_TICK_COUNT);
  return Math.floor(range / step) < MIN_TICK_COUNT ? niceStep(range / MIN_TICK_COUNT) : step;
}

function decimalsOf(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step)) + 1);
}

/** Ticks at round numbers for a plain numeric axis: the value axis, or X of a chart that is not over time. */
export function linearTicks(options: ILinearTicksOptions = {}): ITickGenerator<number> {
  const minGapPx = (options.labelSizePx ?? DEFAULT_LABEL_SIZE_PX) + MIN_LABEL_GAP_PX;

  return {
    ticks(axis): readonly IAxisTick<number>[] {
      const { start, end } = axis.range;
      const range = end - start;
      if (range <= 0) {
        return [{ position: start, label: start.toFixed(DEGENERATE_RANGE_DECIMALS) }];
      }
      const step = stepOf(range);
      const decimals = decimalsOf(step);
      const candidates: number[] = [];
      for (
        let value = Math.ceil(start / step - STEP_TOLERANCE) * step;
        value <= end + step * STEP_TOLERANCE;
        value += step
      ) {
        // A range that ends a hair short of a round value, by rounding, still has its tick there — at its own end.
        if (value >= start - step * STEP_TOLERANCE && value <= end + step * STEP_TOLERANCE) {
          candidates.push(Math.min(Math.max(value, start), end) + 0);
        }
      }
      return laidOut(candidates, axis, minGapPx, (_, shown) => ({
        label: shown.toFixed(decimals),
        rank: 0,
      }));
    },
    format(position, { range: { start, end } }): string {
      const range = end - start;
      return position.toFixed(range > 0 ? decimalsOf(stepOf(range)) : DEGENERATE_RANGE_DECIMALS);
    },
  };
}
