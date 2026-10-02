/**
 * The steps a time series may be aggregated by, in nanoseconds. Each divides
 * the next, and intervals are counted from the Unix epoch in UTC, so an
 * element of a coarser scale is always a whole number of finer ones (§4.3).
 */
export const TIME_SCALE = {
  milliseconds1: 1_000_000n,
  milliseconds5: 5_000_000n,
  milliseconds20: 20_000_000n,
  milliseconds100: 100_000_000n,
  milliseconds500: 500_000_000n,
  seconds1: 1_000_000_000n,
  seconds5: 5_000_000_000n,
  seconds15: 15_000_000_000n,
  minutes1: 60_000_000_000n,
  minutes5: 300_000_000_000n,
  minutes15: 900_000_000_000n,
  hours1: 3_600_000_000_000n,
  hours4: 14_400_000_000_000n,
  hours12: 43_200_000_000_000n,
  days1: 86_400_000_000_000n,
  days5: 432_000_000_000_000n,
  days15: 1_296_000_000_000_000n,
  days60: 5_184_000_000_000_000n,
  days240: 20_736_000_000_000_000n,
} as const;

export type TTimeScale = (typeof TIME_SCALE)[keyof typeof TIME_SCALE];

/** The whole grid, finest first. */
export const TIME_SCALES: readonly TTimeScale[] = Object.values(TIME_SCALE);
