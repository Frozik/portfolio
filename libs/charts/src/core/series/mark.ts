import type { IValueRange } from '../viewport/axis-domain';
import type { TRun } from './point-run';
import type { TShape } from './shape';

/** A way to draw data: a line, an area, a marker, a candle (§5.3). */
export interface IMark {
  readonly id: string;
  /** The data shapes the mark can draw: its row of the compatibility map (§5.4). */
  readonly shapes: readonly TShape[];
  /** The values elements `from`…`to` (exclusive) reach, for autoscaling; none when they are all gaps. */
  valueRange<TX>(
    run: TRun<TX>,
    from: number,
    to: number,
    options: unknown
  ): IValueRange | undefined;
  /** What draws the mark, by backend id; attached by the backend the mark is imported from (§6.2). */
  readonly painters: Readonly<Record<string, unknown>>;
}

/** The values a slice of a run reaches: candles by their extremes, gaps skipped. */
export function valueRangeOfElements<TX>(
  run: TRun<TX>,
  from: number,
  to: number
): IValueRange | undefined {
  const lows = run.shape === 'candle' ? run.min : run.value;
  const highs = run.shape === 'candle' ? run.max : run.value;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = from; index < to; index += 1) {
    const low = lows[index];
    const high = highs[index];
    if (Number.isNaN(low) || Number.isNaN(high)) {
      continue;
    }
    min = Math.min(min, low);
    max = Math.max(max, high);
  }
  return min <= max ? { min, max } : undefined;
}

/** The same mark carrying a painter for one more backend. */
export function withPainter(mark: IMark, backend: string, painter: unknown): IMark {
  return { ...mark, painters: { ...mark.painters, [backend]: painter } };
}
