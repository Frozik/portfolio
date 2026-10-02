const MILLISECOND = 1_000_000n;
const SECOND = 1000n * MILLISECOND;
const MINUTE = 60n * SECOND;
const HOUR = 60n * MINUTE;
const DAY = 24n * HOUR;
const AVERAGE_MONTH = 30n * DAY;
const AVERAGE_YEAR = 365n * DAY;

/** What a tick step is counted in: this decides both where ticks stand and how they are labelled. */
export type TTimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

export interface ITimeStep {
  readonly unit: TTimeUnit;
  readonly count: number;
  /** Nanoseconds the step lasts; an average for months and years, used only to choose a step. */
  readonly duration: bigint;
}

function steps(unit: TTimeUnit, unitDuration: bigint, counts: readonly number[]): ITimeStep[] {
  return counts.map(count => ({ unit, count, duration: unitDuration * BigInt(count) }));
}

/** Every step a time axis may tick at, finest first. */
export const TIME_STEPS: readonly ITimeStep[] = [
  ...steps('millisecond', MILLISECOND, [1, 2, 5, 10, 20, 50, 100, 200, 500]),
  ...steps('second', SECOND, [1, 2, 5, 10, 15, 30]),
  ...steps('minute', MINUTE, [1, 2, 5, 10, 15, 30]),
  ...steps('hour', HOUR, [1, 2, 3, 6, 12]),
  ...steps('day', DAY, [1, 2, 7, 14]),
  ...steps('month', AVERAGE_MONTH, [1, 3, 6]),
  ...steps('year', AVERAGE_YEAR, [1, 2, 5, 10, 25, 50, 100]),
];

/** The finest step that leaves no more than `maxTicks` ticks in a span. */
export function stepFor(spanNanoseconds: number, maxTicks: number): ITimeStep {
  const least = spanNanoseconds / Math.max(1, maxTicks);
  return (
    TIME_STEPS.find(step => Number(step.duration) >= least) ?? TIME_STEPS[TIME_STEPS.length - 1]
  );
}
