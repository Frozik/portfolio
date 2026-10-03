import type { IAxisDomain, IAxisRange } from '../viewport/axis-domain';
import type { IAxisMapping } from '../viewport/axis-mapping';
import type { ChartDataError } from './data-error';
import type { TRun } from './point-run';
import type { TShape } from './shape';

export interface IDataNeed<TX> {
  readonly range: IAxisRange<TX>;
  /** The shape the series draws from: named by its style processor (§5.2). */
  readonly shape: TShape;
  /** CSS pixels along X one element must get: the chart's density (§4.3). */
  readonly pixelsPerElement: number;
  /** CSS pixels the range is spread over. */
  readonly widthPx: number;
}

export interface IDataFailure<TX> {
  readonly range: IAxisRange<TX>;
  readonly error: ChartDataError;
}

/** What a frame needs from the data of a series; how the data is fetched and kept is the data kind's business (§4.1). */
export interface ISeriesData<TX> {
  activate(): void;
  suspend(): void;
  /** Once a frame: everything about to be shown from this data, a need per series. The implementation decides what it lacks and asks for it. */
  prepare(needs: readonly IDataNeed<TX>[]): void;
  /** The data under a need, as contiguous runs ordered along X. */
  runs(need: IDataNeed<TX>): readonly TRun<TX>[];
  /** The known ends of the data along X; an end still unknown is `undefined`. */
  readonly extent: Partial<IAxisRange<TX>>;
  readonly loading: readonly IAxisRange<TX>[];
  readonly failed: readonly IDataFailure<TX>[];
  retry(range: IAxisRange<TX>): void;
  subscribe(listener: IDataListener<TX>): VoidFunction;
  dispose(): void;
}

export interface IDataListener<TX> {
  changed(range: IAxisRange<TX>): void;
  failed(failure: IDataFailure<TX>): void;
}

export interface IDataContext<TX> {
  readonly domain: IAxisDomain<TX>;
  /** The cuts of the axis; data is handed over and asked for in the world coordinate and kept in the virtual one. */
  readonly mapping: IAxisMapping<TX> | undefined;
}

/** A description of data that a chart turns into one live instance, shared by every series naming it (§4.1). */
export interface ISeriesDataFactory<TX> {
  create(context: IDataContext<TX>): ISeriesData<TX>;
}
