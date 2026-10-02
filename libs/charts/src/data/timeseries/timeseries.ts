import { isNil } from 'lodash-es';

import type { ISeriesDataFactory } from '../../core/series/series-data';
import type { IPersistentCache } from './cache/persistent-cache';
import type { IRetryPolicy } from './failure-log';
import type { ITimeseriesSource } from './source';
import type { TTimeScale } from './time-scale';
import { TIME_SCALES } from './time-scale';
import { TimeseriesData } from './timeseries-data';

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_MAX_ELEMENTS = 2_000_000;
const DEFAULT_RETRY: IRetryPolicy = { delayMs: 1000, maxDelayMs: 30_000 };

export interface ITimeseriesOptions {
  /** The lasting name of the series: what its data is kept under between sessions. Without it nothing is kept (§4.7). */
  readonly key?: string;
  /** The scales the series may be asked at; the whole grid by default (§4.3). */
  readonly scales?: readonly TTimeScale[];
  /** Room read beyond each edge of what is shown, in its lengths. */
  readonly prefetch?: number;
  readonly maxConcurrent?: number;
  /** Asks again by itself after a transient failure, pausing longer each time; off by default (§4.6). */
  readonly retry?: boolean | IRetryPolicy;
  readonly cache?: {
    /** How many elements are kept in memory; what is on screen is kept whatever the number (§4.7). */
    readonly memory?: { readonly maxElements?: number };
    /** Where what is read outlives the page; needs `key`. Nothing is written to disk unless asked. */
    readonly persistent?: IPersistentCache;
  };
  /** Milliseconds on a clock that only runs forward; the page's by default. */
  readonly now?: () => number;
}

function retryOf(retry: ITimeseriesOptions['retry']): IRetryPolicy | undefined {
  if (retry === true) {
    return DEFAULT_RETRY;
  }
  return retry === false ? undefined : retry;
}

/**
 * An endless series over time whose past never changes: history is read on
 * demand, the new arrives by subscription. A description — the chart makes
 * one live instance of it for all the series that name it (§4.4).
 */
export function timeseries(
  source: ITimeseriesSource,
  options: ITimeseriesOptions = {}
): ISeriesDataFactory<bigint> {
  const { key } = options;
  const cache = options.cache?.persistent;
  return {
    create: () =>
      new TimeseriesData({
        persistent: isNil(key) || isNil(cache) ? undefined : { cache, key },
        source,
        scales: [...(options.scales ?? TIME_SCALES)].sort((first, second) =>
          first < second ? -1 : 1
        ),
        prefetch: options.prefetch ?? 0,
        maxConcurrent: options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
        retry: retryOf(options.retry),
        maxElements: options.cache?.memory?.maxElements ?? DEFAULT_MAX_ELEMENTS,
        now: options.now ?? (() => performance.now()),
      }),
  };
}
