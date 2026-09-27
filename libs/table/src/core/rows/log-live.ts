import { makeAutoObservable } from 'mobx';

/**
 * The live side of a log: from which moment the stream is complete, whether
 * history has met that moment, and the rows held back until it has or until
 * the user returns to the fresh edge.
 */
export class LogLiveLane<TRow> {
  startedAt: string | undefined = undefined;
  complete = false;
  private buffer: readonly TRow[] = [];
  private readonly capacity: number;
  /** A gap restore in flight; plain state, no view reads it. */
  restoring = false;

  constructor(capacity: number) {
    this.capacity = capacity;
    makeAutoObservable<LogLiveLane<TRow>, 'capacity' | 'restoring'>(
      this,
      { capacity: false, restoring: false },
      { autoBind: true }
    );
  }

  get buffered(): number {
    return this.buffer.length;
  }

  start(at: string): void {
    this.startedAt = at;
    this.complete = false;
  }

  reset(): void {
    this.startedAt = undefined;
    this.complete = false;
    this.buffer = [];
    this.restoring = false;
  }

  hold(rows: readonly TRow[]): void {
    this.buffer = [...this.buffer, ...rows].slice(-this.capacity);
  }

  /** The held rows, in arrival order; the buffer is empty afterwards. */
  take(): readonly TRow[] {
    const rows = this.buffer;
    this.buffer = [];
    return rows;
  }
}
