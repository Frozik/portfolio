import { MAGNITUDE_EMA_ALPHA } from './constants';
import { lerp } from './math';

/** Smoothed `price × volume` bounds that normalise heatmap colours across flushes. */
export interface IMagnitudeRange {
  readonly min: number;
  readonly max: number;
}

export const INITIAL_MAGNITUDE_RANGE: IMagnitudeRange = { min: 0, max: 1 };

/**
 * Folds one flush's observed bounds into the running range. The first live
 * flush seeds the range; later ones move it by an EMA. An empty flush (both
 * bounds `0`) is the quantizer filling a disconnect gap and leaves the range
 * untouched so colours do not drift toward zero while the chart advances.
 */
export function updateMagnitudeRange(
  range: IMagnitudeRange | undefined,
  latestMin: number,
  latestMax: number
): IMagnitudeRange | undefined {
  const isEmptyFlush = latestMin === 0 && latestMax === 0;
  if (isEmptyFlush) {
    return range;
  }
  if (range === undefined) {
    return { min: latestMin, max: latestMax };
  }
  return {
    min: lerp(range.min, latestMin, MAGNITUDE_EMA_ALPHA),
    max: lerp(range.max, latestMax, MAGNITUDE_EMA_ALPHA),
  };
}
