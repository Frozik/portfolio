import type { ISeriesFrame } from '../frame/chart-frame';
import { sampleAt } from '../series/sample';
import { lowerBound } from '../series/search';
import type { IAxisDomain } from '../viewport/axis-domain';

/**
 * The value per cent labels are counted from: the first one in view of the
 * first series that has any — a candle counts by its close, a gap is skipped.
 */
export function percentBaseOf<TX>(
  domain: IAxisDomain<TX>,
  viewStart: TX,
  series: readonly ISeriesFrame<TX>[]
): number | undefined {
  for (const { runs } of series) {
    for (const { run } of runs) {
      const first = lowerBound(domain, run.x, run.length, viewStart);
      for (let index = first; index < run.length; index += 1) {
        const { value } = sampleAt(run, index);
        if (!Number.isNaN(value)) {
          return value;
        }
      }
    }
  }
  return undefined;
}
