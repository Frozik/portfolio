import type { TColumns } from '../../../core/series/columns';
import type { IInterval } from '../interval';

/** An interval of time about which everything is known, with its elements. */
export interface IStoredSegment extends IInterval {
  readonly columns: TColumns;
}

/**
 * A place where what a time series has read outlives the page: the past of a
 * series never changes, so what was stored stays true (§4.7). Implementations
 * never reject and never throw — a failed read is a miss, a failed write is
 * forgotten: a cache must not be able to break a chart.
 */
export interface IPersistentCache {
  /** The stored segments of a series that reach into `interval`. */
  read(seriesKey: string, interval: IInterval): Promise<readonly IStoredSegment[]>;
  write(seriesKey: string, segment: IStoredSegment): void;
}
