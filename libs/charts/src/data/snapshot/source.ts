import type { TBatch, TShape } from '../../core/series/shape';
import type { IAxisRange } from '../../core/viewport/axis-domain';

export interface ISnapshotRequest<TX> {
  readonly from: TX;
  readonly to: TX;
  /** One of the scales the application named; absent when it named none. */
  readonly scale?: number;
  readonly shape: TShape;
  /** How many elements are worth sending: a hint, not a limit. */
  readonly maxElements: number;
  readonly signal: AbortSignal;
}

export interface ISnapshotWindow<TX> {
  /** Ascending by X. */
  readonly data: TBatch<TX>;
  /** What the answer covers whole; may be wider than asked. Absent: the answer is everything there is. */
  readonly range?: IAxisRange<TX>;
}

/** A set of elements that becomes another with time: read by window, replaced whole (§4.5). */
export interface ISnapshotSource<TX> {
  fetch(request: ISnapshotRequest<TX>): Promise<ISnapshotWindow<TX>>;
  /** The data in `range` became different; without a range, all of it. */
  subscribe(onChange: (range?: IAxisRange<TX>) => void): VoidFunction;
}
