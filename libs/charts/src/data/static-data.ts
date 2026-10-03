import { isNil } from 'lodash-es';

import { columnsOf } from '../core/series/columns';
import { ChartDataError } from '../core/series/data-error';
import type { TAggregateTime, TRun } from '../core/series/point-run';
import { DEFAULT_AGGREGATE_TIME, rangeOfRun, runOf } from '../core/series/point-run';
import type {
  IDataFailure,
  IDataNeed,
  ISeriesData,
  ISeriesDataFactory,
} from '../core/series/series-data';
import type { TBatch } from '../core/series/shape';
import type { IAxisRange } from '../core/viewport/axis-domain';

const STATIC_RUN_ID = 1;

export interface IStaticDataOptions {
  /** Length of one element's interval in axis units, for data that is aggregated. */
  readonly step?: number;
  /** What an aggregated element's position marks; the start of its interval by default. */
  readonly aggregateTime?: TAggregateTime;
}

/** A set of points or candles that never changes: all of it is there from the start (§4.1). */
export function staticData<TX>(
  batch: TBatch<TX>,
  options: IStaticDataOptions = {}
): ISeriesDataFactory<TX> {
  return {
    create(): ISeriesData<TX> {
      const columns = columnsOf(batch);
      const run: TRun<TX> | undefined =
        columns.length === 0
          ? undefined
          : runOf(columns, {
              id: STATIC_RUN_ID,
              revision: 0,
              step: options.step,
              aggregateTime: options.aggregateTime ?? DEFAULT_AGGREGATE_TIME,
            });
      const runs = isNil(run) ? [] : [run];
      const failures = new Map<string, IDataFailure<TX>>();

      return {
        activate(): void {},
        suspend(): void {},
        prepare(needs: readonly IDataNeed<TX>[]): void {
          for (const need of needs) {
            if (need.shape !== batch.shape && !failures.has(need.shape)) {
              failures.set(need.shape, {
                range: need.range,
                error: new ChartDataError(
                  'NOT_FOUND',
                  `the data is ${batch.shape}s; ${need.shape}s were asked for`
                ),
              });
            }
          }
        },
        runs: need => (need.shape === batch.shape ? runs : []),
        get extent(): Partial<IAxisRange<TX>> {
          return isNil(run) ? {} : rangeOfRun(run);
        },
        loading: [],
        get failed(): readonly IDataFailure<TX>[] {
          return [...failures.values()];
        },
        retry(): void {},
        subscribe: () => () => {},
        dispose(): void {},
      };
    },
  };
}
