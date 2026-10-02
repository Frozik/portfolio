import type { ISeriesDataFactory } from '../../core/series/series-data';
import { SnapshotData } from './snapshot-data';
import type { ISnapshotSource } from './source';

export interface ISnapshotOptions {
  /** The steps the source can aggregate by, in axis units; without them the source is asked by density alone (§4.5). */
  readonly scales?: readonly number[];
}

/** A window over data that changes: asked again when the view leaves it, the scale changes, or the source says so. */
export function snapshot<TX>(
  source: ISnapshotSource<TX>,
  options: ISnapshotOptions = {}
): ISeriesDataFactory<TX> {
  return {
    create: ({ domain }) =>
      new SnapshotData<TX>({
        source,
        domain,
        scales: options.scales?.toSorted((first, second) => first - second),
      }),
  };
}
