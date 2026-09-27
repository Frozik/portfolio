import type { TGuard } from '../kernel/command-bus';
import type { ITableCommands } from '../kernel/contracts';
import type { TDisplayRow } from './display-row';
import type { IPipelineStage } from './pipeline';
import type { IRowQuery } from './row-query';

export interface IRowRange {
  readonly start: number;
  readonly end: number;
}

export const EMPTY_RANGE: IRowRange = { start: 0, end: 0 };

/**
 * The port every data mode implements. Rows are addressed by display index;
 * the source decides what is in memory and answers with a placeholder for the
 * rest. Changing the query starts a new epoch: whatever was cached belongs to
 * the previous one.
 */
export interface IRowSource<TRow> {
  readonly rowCount: number | undefined;
  readonly hasMore: boolean;
  readonly epoch: number;
  rowAt(index: number): TDisplayRow<TRow>;
  keyAt(index: number): string;
  indexOf(rowKey: string): number | undefined;
  setQuery(query: IRowQuery): void;
  setRange(range: IRowRange): void;
  refresh(options?: { readonly purge?: boolean }): void;
  dispose(): void;
}

export interface IRowSourceContext<TRow> {
  rowKey(row: TRow): string;
  /** Stages contributed by extensions, in execution order; complete once every extension is registered. */
  readonly pipeline: readonly IPipelineStage<TRow>[];
  /** Hands a transport or server failure to the application's `onSourceError`. */
  reportError(error: unknown): void;
  /** Lets a source refuse what its server cannot do (a log sorts by time only); the reason reaches the UI. */
  guard<TName extends keyof ITableCommands>(
    command: TName,
    guard: TGuard<ITableCommands[TName]>
  ): VoidFunction;
}

export type TRowSourceFactory<TRow> = (context: IRowSourceContext<TRow>) => IRowSource<TRow>;
