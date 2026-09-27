import { computed, makeAutoObservable } from 'mobx';

import type { TDisplayRow } from './display-row';
import { leafRow } from './display-row';
import { runPipeline } from './pipeline';
import type { IRowSource, IRowSourceContext, TRowSourceFactory } from './row-source';

const PLACEHOLDER_KEY = '';

/**
 * A source of every row in memory. The derived rows and the key index are
 * kept alive: cells observe them, and when a scroll replaces every cell at
 * once the last observer leaves before the first new one arrives, which
 * would otherwise throw the cache away on each window.
 */
class ClientRowSource<TRow> implements IRowSource<TRow> {
  readonly hasMore = false;
  readonly epoch = 0;
  private readonly displayRowsBox = computed(
    () => runPipeline(this.context.pipeline, this.leaves),
    {
      keepAlive: true,
    }
  );
  private readonly indexByKeyBox = computed(
    () => new Map(this.displayRows.map((row, index) => [row.key, index])),
    { keepAlive: true }
  );

  constructor(
    private readonly context: IRowSourceContext<TRow>,
    private readonly rows: () => readonly TRow[],
    private readonly externalFilter: ((row: TRow) => boolean) | undefined
  ) {
    makeAutoObservable<
      ClientRowSource<TRow>,
      | 'context'
      | 'rows'
      | 'externalFilter'
      | 'displayRowsBox'
      | 'indexByKeyBox'
      | 'displayRows'
      | 'indexByKey'
    >(
      this,
      {
        context: false,
        rows: false,
        externalFilter: false,
        displayRowsBox: false,
        indexByKeyBox: false,
        displayRows: false,
        indexByKey: false,
        rowAt: false,
        keyAt: false,
        indexOf: false,
      },
      { autoBind: true }
    );
  }

  private get leaves(): readonly TDisplayRow<TRow>[] {
    const rows = this.rows();
    const accepted = this.externalFilter === undefined ? rows : rows.filter(this.externalFilter);
    return accepted.map(row => leafRow(this.context.rowKey(row), row));
  }

  private get displayRows(): readonly TDisplayRow<TRow>[] {
    return this.displayRowsBox.get();
  }

  private get indexByKey(): ReadonlyMap<string, number> {
    return this.indexByKeyBox.get();
  }

  get rowCount(): number {
    return this.displayRows.length;
  }

  rowAt(index: number): TDisplayRow<TRow> {
    return this.displayRows[index] ?? { kind: 'loading', key: PLACEHOLDER_KEY };
  }

  keyAt(index: number): string {
    return this.rowAt(index).key;
  }

  indexOf(rowKey: string): number | undefined {
    return this.indexByKey.get(rowKey);
  }

  setQuery(): void {
    // The pipeline stages read their own state; a client source has nothing to re-request.
  }

  setRange(): void {
    // Every row is already in memory.
  }

  refresh(): void {
    // Rows are a computed of the application store; there is nothing stale to drop.
  }

  dispose(): void {
    // No subscriptions of its own.
  }
}

/** Rows the application already holds; sorting, filtering and grouping run in the kernel pipeline. */
export function clientRows<TRow>(options: {
  readonly rows: () => readonly TRow[];
  readonly externalFilter?: (row: TRow) => boolean;
}): TRowSourceFactory<TRow> {
  return context => new ClientRowSource(context, options.rows, options.externalFilter);
}
