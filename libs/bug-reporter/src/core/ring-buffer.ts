import { isNil } from 'lodash-es';

export interface IRingBufferOptions<TEntry> {
  readonly maxEntries: number;
  /** Optional byte budget on top of the count; entries then need a `sizeOf`. */
  readonly maxBytes?: number;
  readonly sizeOf?: (entry: TEntry) => number;
  /** Returns the folded entry when `next` repeats `last`, so a flood of one line costs one slot. */
  readonly coalesce?: (last: TEntry, next: TEntry) => TEntry | undefined;
}

/**
 * Bounded history of diagnostics: the oldest entries go first when either the
 * count or the byte budget is exceeded, so a chatty page never grows the
 * report without limit.
 */
export class RingBuffer<TEntry> {
  private readonly entries: TEntry[] = [];
  private readonly sizes: number[] = [];
  private bytes = 0;

  constructor(private readonly options: IRingBufferOptions<TEntry>) {}

  get size(): number {
    return this.entries.length;
  }

  push(entry: TEntry): void {
    const last = this.entries.at(-1);
    const folded = isNil(last) ? undefined : this.options.coalesce?.(last, entry);
    if (!isNil(folded)) {
      this.replaceLast(folded);
      return;
    }
    const size = this.sizeOf(entry);
    this.entries.push(entry);
    this.sizes.push(size);
    this.bytes += size;
    this.evict();
  }

  toArray(): readonly TEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
    this.sizes.length = 0;
    this.bytes = 0;
  }

  private sizeOf(entry: TEntry): number {
    return this.options.sizeOf?.(entry) ?? 0;
  }

  private replaceLast(entry: TEntry): void {
    const size = this.sizeOf(entry);
    this.bytes += size - (this.sizes.at(-1) ?? 0);
    this.entries[this.entries.length - 1] = entry;
    this.sizes[this.sizes.length - 1] = size;
  }

  private evict(): void {
    while (
      this.entries.length > 1 &&
      (this.entries.length > this.options.maxEntries ||
        this.bytes > (this.options.maxBytes ?? Number.POSITIVE_INFINITY))
    ) {
      this.entries.shift();
      this.bytes -= this.sizes.shift() ?? 0;
    }
  }
}
