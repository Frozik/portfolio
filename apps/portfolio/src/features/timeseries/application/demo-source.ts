import type { ChartDataError } from '@frozik/charts/core/series/data-error';
import type { IAxisMapping } from '@frozik/charts/core/viewport/axis-mapping';
import type { ITimeseriesSource } from '@frozik/charts/data/timeseries/source';
import { isNil } from 'lodash-es';

import type { INoiseOptions } from '../domain/noise';
import { createNoise } from '../domain/noise';
import { sessionGrid } from '../infrastructure/bar-grid';
import { noiseSource } from '../infrastructure/noise-source';

/** How the demo sources behave right now: the switches of the debug panel. */
export interface ISourceConditions {
  delayMs(): number;
  failure(): ChartDataError | undefined;
}

export interface IDemoSourceOptions extends INoiseOptions {
  /** The present moment, for a series with a live edge. */
  readonly now?: () => bigint;
  /** What the noise is turned into: a volume, a momentum, a growth curve. The noise itself when not given. */
  readonly shape?: (noise: number) => number;
  /** The sessions the source trades in: its bars are counted from the opening of each; round the clock when not given. */
  readonly sessions?: IAxisMapping<bigint>;
}

/** A source of synthetic data that answers as slowly, and fails as readily, as the demo is told to. */
export function demoSource(
  { now, shape, sessions, ...options }: IDemoSourceOptions,
  conditions: ISourceConditions
): ITimeseriesSource {
  const noise = createNoise(options);
  return noiseSource({
    noise: isNil(shape) ? noise : time => shape(noise(time)),
    delayMs: conditions.delayMs,
    failure: conditions.failure,
    now,
    gridOf: isNil(sessions) ? undefined : scale => sessionGrid(scale, sessions),
  });
}
