import type { ChartDataError } from '@frozik/charts/core/series/data-error';
import type { ITimeseriesSource } from '@frozik/charts/data/timeseries/source';

import type { INoiseOptions } from '../domain/noise';
import { createNoise } from '../domain/noise';
import { noiseSource } from '../infrastructure/noise-source';

/** How the demo sources behave right now: the switches of the debug panel. */
export interface ISourceConditions {
  delayMs(): number;
  failure(): ChartDataError | undefined;
}

export interface IDemoSourceOptions extends INoiseOptions {
  /** The present moment, for a series with a live edge. */
  readonly now?: () => bigint;
}

/** A source of synthetic data that answers as slowly, and fails as readily, as the demo is told to. */
export function demoSource(
  { now, ...noise }: IDemoSourceOptions,
  conditions: ISourceConditions
): ITimeseriesSource {
  return noiseSource({
    noise: createNoise(noise),
    delayMs: conditions.delayMs,
    failure: conditions.failure,
    now,
  });
}
