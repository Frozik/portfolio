import type { ISeriesDataFactory } from './series-data';
import type { IStyleProcessor } from './style-processor';

/** Data and a style processor: what the user sees as one graph on the axes (§5.1). */
export interface ISeries<TX> {
  readonly id: string;
  /** What the series is called in a legend; its id when not given. */
  readonly name?: string;
  /** The value scale the series is measured against; the first scale of the chart when not given. */
  readonly scale?: string;
  readonly data: ISeriesDataFactory<TX>;
  readonly style: IStyleProcessor<TX>;
}

/** The axis type comes from the data; a style processor written for any axis fits. */
export function series<TX>(definition: {
  readonly id: string;
  readonly name?: string;
  readonly scale?: string;
  readonly data: ISeriesDataFactory<TX>;
  readonly style: NoInfer<IStyleProcessor<TX>>;
}): ISeries<TX> {
  return definition;
}
