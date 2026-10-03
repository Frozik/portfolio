import { isNil } from 'lodash-es';
import type { TAggregateTime } from '../../core/series/point-run';
import { DEFAULT_AGGREGATE_TIME } from '../../core/series/point-run';

import type { ISeriesDataFactory } from '../../core/series/series-data';
import { BreakMarking } from '../cuts/break-marking';
import { cutSnapshotSource } from './cut-source';
import { SnapshotData } from './snapshot-data';
import type { ISnapshotSource } from './source';

export interface ISnapshotOptions {
  /** The steps the source can aggregate by, in axis units; without them the source is asked by density alone (§4.5). */
  readonly scales?: readonly number[];
  /** What the position of an aggregated element marks; the start of its interval by default. */
  readonly aggregateTime?: TAggregateTime;
}

/** A window over data that changes: asked again when the view leaves it, the scale changes, or the source says so. */
export function snapshot<TX>(
  source: ISnapshotSource<TX>,
  options: ISnapshotOptions = {}
): ISeriesDataFactory<TX> {
  const aggregateTime = options.aggregateTime ?? DEFAULT_AGGREGATE_TIME;
  return {
    create: ({ domain, mapping }) =>
      new SnapshotData<TX>({
        source: isNil(mapping) ? source : cutSnapshotSource(source, domain, mapping, aggregateTime),
        domain,
        scales: options.scales?.toSorted((first, second) => first - second),
        aggregateTime,
        breaks: new BreakMarking(domain, mapping),
      }),
  };
}
