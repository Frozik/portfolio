import type { UnixTimeMs } from './types';

/**
 * Bounded FIFO buffer keyed by a monotonic `timestampMs`.
 *
 * Consumers call `drain(fromMs, toMs)` once per tick to pull all events
 * whose timestamp falls into the half-open interval `[fromMs, toMs)`.
 * Drained events leave the buffer. Anything strictly older than
 * `fromMs` at drain time is discarded as stale. Events whose timestamp
 * is `>= toMs` stay in the buffer for a future tick.
 */
export class TimestampedEventBuffer<T extends { readonly timestampMs: UnixTimeMs }> {
  private readonly items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  /**
   * Remove and return every buffered event with
   * `timestampMs >= fromMs && timestampMs < toMs`. Events older than
   * `fromMs` are dropped. Events at or beyond `toMs` stay buffered.
   */
  drain(fromMs: UnixTimeMs, toMs: UnixTimeMs): T[] {
    const drained: T[] = [];
    const kept: T[] = [];
    for (const item of this.items) {
      if (item.timestampMs < fromMs) {
        continue;
      }
      if (item.timestampMs < toMs) {
        drained.push(item);
        continue;
      }
      kept.push(item);
    }
    this.items.length = 0;
    this.items.push(...kept);
    return drained;
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
