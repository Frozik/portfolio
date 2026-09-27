import type { TLogDirection } from './log-lanes';
import type { IRowQuery } from './row-query';

export interface ILogFetchParams {
  readonly query: IRowQuery;
  readonly from: string;
  readonly fromExclusive: boolean;
  readonly till: string;
  readonly tillExclusive: boolean;
  /** The server may answer more, so rows sharing one timestamp are never split. */
  readonly softLimit: number;
  readonly direction: TLogDirection;
  readonly signal: AbortSignal;
}

export type TLogLiveEvent<TRow> =
  | { readonly kind: 'start'; readonly at: string }
  | { readonly kind: 'append'; readonly rows: readonly TRow[] }
  | { readonly kind: 'error'; readonly error: unknown };

export interface ILogRowsOptions<TRow> {
  time(row: TRow): string;
  /** The column that holds the time: the only one the log can sort by. */
  readonly timeColumnId: string;
  fetch(params: ILogFetchParams): Promise<readonly TRow[]>;
  subscribe?(
    params: { readonly query: IRowQuery; readonly signal: AbortSignal },
    emit: (event: TLogLiveEvent<TRow>) => void
  ): VoidFunction;
  readonly range?: { readonly from?: string; readonly till?: string };
  readonly chunkRows?: number;
  readonly restoreMax?: number;
  readonly liveBufferMax?: number;
  now?(): string;
}

/** What the live chip reads off a log source: rows held back until the user is at the fresh edge. */
export interface ILiveRowSource {
  readonly buffered: number;
  readonly direction: TLogDirection;
  readonly liveStopped: boolean;
  flush(): void;
}

export function isLiveRowSource(source: unknown): source is ILiveRowSource {
  return typeof source === 'object' && source !== null && 'buffered' in source && 'flush' in source;
}
