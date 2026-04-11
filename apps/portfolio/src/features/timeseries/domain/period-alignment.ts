import type { ETimeScale } from './types';

/** Default number of buffer periods added on each side of the viewport. */
const DEFAULT_BUFFER_PERIODS = 1;

export interface IAlignedPeriod {
  readonly start: number;
  readonly end: number;
}

/**
 * Compute period-aligned time intervals that cover the given viewport range,
 * with optional buffer periods on each side for smooth panning.
 *
 * Each period has a fixed duration equal to the scale's enum value (in seconds).
 * Periods are aligned to epoch-based boundaries (e.g., for scale 3600,
 * boundaries fall at epoch + N * 3600).
 */
export function alignedPeriods(
  viewTimeStart: number,
  viewTimeEnd: number,
  scale: ETimeScale,
  bufferPeriods: number = DEFAULT_BUFFER_PERIODS
): ReadonlyArray<IAlignedPeriod> {
  const duration = scale as number;

  const alignedStart = Math.floor(viewTimeStart / duration) * duration - bufferPeriods * duration;
  const alignedEnd = Math.ceil(viewTimeEnd / duration) * duration + bufferPeriods * duration;

  const periodCount = Math.round((alignedEnd - alignedStart) / duration);
  const periods: IAlignedPeriod[] = new Array(periodCount);

  for (let index = 0; index < periodCount; index++) {
    const periodStart = alignedStart + index * duration;
    periods[index] = {
      start: periodStart,
      end: periodStart + duration,
    };
  }

  return periods;
}
