import type { ISeriesDataFactory } from './series-data';
import type { IStyleProcessor } from './style-processor';

/** Data and a style processor: what the user sees as one graph on the axes (§5.1). */
export interface ISeries<TX> {
  readonly id: string;
  readonly data: ISeriesDataFactory<TX>;
  readonly style: IStyleProcessor<TX>;
}

/** The axis type comes from the data; a style processor written for any axis fits. */
export function series<TX>(definition: {
  readonly id: string;
  readonly data: ISeriesDataFactory<TX>;
  readonly style: NoInfer<IStyleProcessor<TX>>;
}): ISeries<TX> {
  return definition;
}
