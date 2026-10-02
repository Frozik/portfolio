import { isNil } from 'lodash-es';

import type { TColumns } from '../../../core/series/columns';
import { sliceColumns } from '../column-buffer';
import type { IInterval } from '../interval';
import { intersection, subtract } from '../interval';
import type { SegmentStore } from '../segment-store';
import type { IPersistentCache } from './persistent-cache';

export interface IPersistedSegmentsOptions {
  readonly cache: IPersistentCache;
  /** The name the series is kept under at this shape and scale. */
  readonly key: string;
  readonly store: SegmentStore;
  onRestored(interval: IInterval): void;
}

/**
 * The persistent cache as one channel uses it: before the source is asked for
 * a hole, the cache is asked once; what it holds goes into memory, and the
 * source is left with the rest (§4.7).
 */
export class PersistedSegments {
  /** What the cache has been asked about. */
  private checked: readonly IInterval[] = [];
  private readonly reads = new Set<IInterval>();

  constructor(private readonly options: IPersistedSegmentsOptions) {}

  /** The intervals being read right now: the source is not asked for them yet. */
  get reading(): readonly IInterval[] {
    return [...this.reads];
  }

  /**
   * Asks for whatever of `wanted` is neither in memory nor asked about before.
   * What the source is already being asked for (`requested`) is left to it:
   * its answer and a restored piece must not cover the same moment twice.
   */
  restore(wanted: IInterval, requested: readonly IInterval[]): void {
    const { cache, key, store, onRestored } = this.options;
    const known = [...store.covered, ...this.checked, ...this.reads, ...requested];
    for (const hole of subtract(wanted, known)) {
      this.reads.add(hole);
      void cache.read(key, hole).then(segments => {
        if (!this.reads.delete(hole)) {
          return;
        }
        this.checked = [...this.checked, hole];
        for (const segment of segments) {
          const stored = intersection(segment, hole);
          for (const piece of isNil(stored) ? [] : subtract(stored, store.covered)) {
            store.cover(piece, sliceColumns(segment.columns, piece.start, piece.end));
            onRestored(piece);
          }
        }
      });
    }
  }

  keep(interval: IInterval, columns: TColumns): void {
    this.options.cache.write(this.options.key, { ...interval, columns });
  }

  /** Whatever is being read is no longer wanted: its answers are dropped. */
  cancelReads(): void {
    this.reads.clear();
  }

  /** Memory was freed: what was once restored may be gone, so the cache is worth asking again. */
  forgetChecked(): void {
    this.checked = [];
  }
}
