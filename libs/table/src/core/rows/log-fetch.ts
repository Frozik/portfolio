import type { ILogFetchParams } from './log-contracts';
import type { TLogDirection } from './log-lanes';
import type { IRowQuery } from './row-query';

const EARLIEST = '0000-01-01T00:00:00Z';
const LATEST = '9999-12-31T23:59:59Z';

export interface IChunkRequest {
  readonly query: IRowQuery;
  readonly direction: TLogDirection;
  readonly range: { readonly from?: string; readonly till?: string } | undefined;
  /** The time at the far end of the lane, where the next chunk continues; `undefined` for the first one. */
  readonly oldest: string | undefined;
  readonly softLimit: number;
  readonly now: string;
  readonly signal: AbortSignal;
}

/** The next history chunk: backward walks from the far end towards `range.from`, forward the other way. */
export function chunkParams(request: IChunkRequest): ILogFetchParams {
  const { query, direction, range, oldest, softLimit, now, signal } = request;
  if (direction === 'backward') {
    return {
      query,
      from: range?.from ?? EARLIEST,
      fromExclusive: false,
      till: oldest ?? range?.till ?? now,
      tillExclusive: oldest !== undefined,
      softLimit,
      direction,
      signal,
    };
  }
  return {
    query,
    from: oldest ?? range?.from ?? EARLIEST,
    fromExclusive: oldest !== undefined,
    till: range?.till ?? LATEST,
    tillExclusive: false,
    softLimit,
    direction,
    signal,
  };
}

export interface IGapRequest {
  readonly query: IRowQuery;
  readonly direction: TLogDirection;
  /** The freshest history row already in the lane. */
  readonly freshest: string;
  /** The moment the live stream became complete. */
  readonly at: string;
  readonly softLimit: number;
  readonly signal: AbortSignal;
}

/** The rows between loaded history and the live stream, both ends inclusive except the row already held. */
export function gapParams(request: IGapRequest): ILogFetchParams {
  const { query, direction, freshest, at, softLimit, signal } = request;
  return {
    query,
    from: freshest,
    fromExclusive: true,
    till: at,
    tillExclusive: false,
    softLimit,
    direction,
    signal,
  };
}
