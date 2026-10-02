import type { IChartSize } from '../host/size-source';
import type { IDataFailure } from '../series/series-data';
import type { IAxisRange } from '../viewport/axis-domain';

/** What a chart tells the outside about; extension slices add their own events (§3.3). */
export interface IChartEvents<TX> {
  readonly 'viewport.changed': undefined;
  readonly 'size.changed': { readonly previous: IChartSize | undefined; readonly next: IChartSize };
  readonly 'data.changed': {
    readonly seriesIds: readonly string[];
    readonly range: IAxisRange<TX>;
  };
  readonly 'data.failed': {
    readonly seriesIds: readonly string[];
    readonly failure: IDataFailure<TX>;
  };
  readonly 'style.changed': { readonly seriesId: string };
  /** A pass of the frame pipeline has ended: whatever a slice shows is settled until the next. */
  readonly 'frame.prepared': undefined;
}
