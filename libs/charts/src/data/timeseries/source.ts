import type { ICandle, IPoint, TBatch, TShape } from '../../core/series/shape';
import type { ICut } from '../../core/viewport/cut';
import type { TTimeScale } from './time-scale';

export type TFetchDirection = 'forward' | 'backward';

export interface IFetchRequest {
  /** The bounds in time; at least one is given. */
  readonly from?: bigint;
  readonly to?: bigint;
  /** Whether elements at exactly the bound are part of the answer. */
  readonly includeFrom: boolean;
  readonly includeTo: boolean;
  readonly scale: TTimeScale;
  readonly shape: TShape;
  /** Which end the answer is cut from when there is more than the limit: `forward` keeps the start, `backward` the end. */
  readonly direction: TFetchDirection;
  /**
   * At least this many elements when the range holds them; having reached it,
   * the source adds every element at the time of the last one given, so a
   * time is never split between two answers (§4.4).
   */
  readonly softLimit: number;
  /**
   * Stretches inside the bounds the chart will throw away — closed sessions.
   * A source that knows them leaves them out; one that does not ignores the
   * field and nothing is lost (sessions §5.2).
   */
  readonly skip?: readonly ICut<bigint>[];
  readonly signal: AbortSignal;
}

export interface ISubscribeRequest {
  readonly scale: TTimeScale;
  readonly shape: TShape;
  /** The subscription took effect: nothing at `since` or before will come through it, only later. May come again after a reconnect. */
  onStart(since: bigint): void;
  /** New elements in non-decreasing order of time, each once. */
  onBatch(batch: TBatch): void;
  /** The element still being formed, or `undefined` once it is closed. */
  onPending?(pending: IPoint | ICandle | undefined): void;
  onError(error: unknown): void;
}

/** A series of time that only grows to the right: history by range, the new by subscription (§4.4). */
export interface ITimeseriesSource {
  /** Elements in ascending order of time, whatever the direction. */
  fetch(request: IFetchRequest): Promise<TBatch>;
  subscribe(request: ISubscribeRequest): VoidFunction;
}
