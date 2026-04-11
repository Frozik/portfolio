import { MIN_TIME_RANGE_SECONDS, Y_PADDING_RATIO } from './constants';
import { ETimeScale } from './types';

/**
 * All time scales sorted from finest (shortest duration) to coarsest (longest duration).
 * Used for scale selection based on viewport duration.
 */
const SORTED_SCALES: readonly ETimeScale[] = [
  ETimeScale.Hour1,
  ETimeScale.Hour12,
  ETimeScale.Day1,
  ETimeScale.Day4,
  ETimeScale.Day16,
  ETimeScale.Day64,
  ETimeScale.Day256,
];

/**
 * Determine the appropriate time scale based on the visible time range duration.
 *
 * Selects the finest scale whose duration is at least as large as the viewport
 * duration. If the viewport exceeds all scale durations, returns the coarsest scale.
 */
export function scaleFromTimeRange(timeStart: number, timeEnd: number): ETimeScale {
  const duration = timeEnd - timeStart;

  for (const scale of SORTED_SCALES) {
    if (duration <= scale) {
      return scale;
    }
  }

  return ETimeScale.Day256;
}

/**
 * Clamp a viewport time range to stay within the data boundaries.
 */
export function clampViewport(
  timeStart: number,
  timeEnd: number,
  minTime: number,
  maxTime: number
): [number, number] {
  const duration = timeEnd - timeStart;

  if (duration >= maxTime - minTime) {
    return [minTime, maxTime];
  }

  if (timeStart < minTime) {
    return [minTime, minTime + duration];
  }

  if (timeEnd > maxTime) {
    return [maxTime - duration, maxTime];
  }

  return [timeStart, timeEnd];
}

/**
 * Compute Y-axis range from the min/max values in the visible data, with padding.
 */
export function autoScaleY(minValue: number, maxValue: number): [number, number] {
  const range = maxValue - minValue;
  const padding = (range > 0 ? range : Math.abs(minValue)) * Y_PADDING_RATIO || 1;

  return [minValue - padding, maxValue + padding];
}

/**
 * Compute Y min/max from part's point arrays, considering only points
 * within the visible time range [timeStart, timeEnd].
 * Uses binary search for efficiency since pointTimes is sorted.
 */
export function visibleYRange(
  pointTimes: Float64Array,
  pointValues: Float64Array,
  timeStart: number,
  timeEnd: number
): [number, number] | undefined {
  const len = pointTimes.length;

  if (len === 0) {
    return undefined;
  }

  // Binary search: find first index where time >= timeStart
  let lo = 0;
  let hi = len;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pointTimes[mid] < timeStart) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const startIdx = lo;

  // Binary search: find last index where time <= timeEnd
  lo = startIdx;
  hi = len;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pointTimes[mid] <= timeEnd) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const endIdx = lo;

  if (startIdx >= endIdx) {
    return undefined;
  }

  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;

  for (let i = startIdx; i < endIdx; i++) {
    const v = pointValues[i];
    if (v < minVal) {
      minVal = v;
    }
    if (v > maxVal) {
      maxVal = v;
    }
  }

  return [minVal, maxVal];
}

/**
 * Pan the viewport by a given pixel delta.
 */
export function panViewport(
  timeStart: number,
  timeEnd: number,
  deltaPixels: number,
  canvasWidth: number
): [number, number] {
  const timeRange = timeEnd - timeStart;
  const timePerPixel = timeRange / canvasWidth;
  const deltaTime = deltaPixels * timePerPixel;

  return [timeStart - deltaTime, timeEnd - deltaTime];
}

/**
 * Zoom the viewport around a normalized center position (0 = left, 1 = right).
 */
export function zoomViewport(
  timeStart: number,
  timeEnd: number,
  factor: number,
  centerNormalized: number
): [number, number] {
  const timeRange = timeEnd - timeStart;
  const centerTime = timeStart + timeRange * centerNormalized;
  const newRange = Math.max(timeRange * factor, MIN_TIME_RANGE_SECONDS);

  const newStart = centerTime - newRange * centerNormalized;
  const newEnd = centerTime + newRange * (1 - centerNormalized);

  return [newStart, newEnd];
}
