import type { Milliseconds } from '@frozik/utils/date/types';

import type { IOrderbookBlockRecord, IOrderbookDb } from '../infrastructure/binance-indexeddb';

import type { BlockRegistry } from './block-registry';
import { FLOATS_PER_TEXEL } from './constants';
import type {
  IBlockMeta,
  IHeatmapViewport,
  IHitTestResult,
  IOrderbookSnapshot,
  UnixTimeMs,
} from './types';
import { viewTimeStartMs } from './viewport';

export interface IActiveBlockSource {
  readonly meta: IBlockMeta;
  readonly data: Float32Array;
}

export interface IDataControllerParams {
  readonly registry: BlockRegistry;
  readonly db: IOrderbookDb | undefined;
  readonly getActiveBlock: () => IActiveBlockSource | null;
  readonly updateSpeedMs: Milliseconds;
  readonly depth: number;
  readonly snapshotSlots: number;
  readonly cacheCapacity?: number;
}

export interface IResolveCellParams {
  readonly pointerPx: { readonly x: number; readonly y: number };
  /**
   * The heatmap plot area in CSS pixels — i.e. full canvas width
   * minus the right-hand Y-axis panel, full canvas height.
   * `pointerPx.x` is treated as an offset into this rect; pointers
   * that fall in the Y-axis panel (x > width) resolve to `null`.
   */
  readonly plotRect: { readonly width: number; readonly height: number };
  readonly viewport: IHeatmapViewport;
  readonly priceStep: number;
}

interface ILocatedSnapshot {
  readonly meta: IBlockMeta;
  readonly data: Float32Array;
  readonly snapshotIndex: number;
}

const DEFAULT_CACHE_CAPACITY = 3;

/**
 * Sole owner of snapshot lookups: active-block fast path, in-memory
 * LRU cache of historical blocks, and async IndexedDB read-through.
 *
 * Every consumer that needs historical / current snapshot data
 * (positioning, hit-test, future exports) goes through this
 * controller. Nobody else touches the cache or the DB directly.
 *
 * Returns a fresh `IOrderbookSnapshot` reconstructed from block data —
 * callers can treat it uniformly regardless of whether the data came
 * from RAM, the LRU cache, or IndexedDB.
 */
export class DataController {
  private readonly registry: BlockRegistry;
  private readonly db: IOrderbookDb | undefined;
  private readonly getActiveBlockSource: () => IActiveBlockSource | null;
  private readonly updateSpeedMs: Milliseconds;
  private readonly depth: number;
  private readonly snapshotSlots: number;
  private readonly cache: BlockRecordLruCache;

  constructor(params: IDataControllerParams) {
    this.registry = params.registry;
    this.db = params.db;
    this.getActiveBlockSource = params.getActiveBlock;
    this.updateSpeedMs = params.updateSpeedMs;
    this.depth = params.depth;
    this.snapshotSlots = params.snapshotSlots;
    this.cache = new BlockRecordLruCache(params.cacheCapacity ?? DEFAULT_CACHE_CAPACITY);
  }

  /**
   * Resolve the most recent snapshot at (or before) `timeMs`. Returns
   * `undefined` only when no block is available — otherwise it falls
   * back to the nearest earlier block so panning past the live edge
   * still yields a sensible right-edge snapshot for Y-axis centering.
   */
  async resolveSnapshotAt(timeMs: UnixTimeMs): Promise<IOrderbookSnapshot | undefined> {
    const located = await this.locateSnapshot(timeMs, { allowNearestEarlier: true });
    if (located === undefined) {
      return undefined;
    }
    return this.reconstructSnapshot(located);
  }

  /**
   * Resolve the specific price-level cell under a pointer. Strict
   * containment — if the pointer is outside any block's time range,
   * returns `null` (matches the old free-standing `hitTest` behaviour).
   */
  async resolveCellAt(params: IResolveCellParams): Promise<IHitTestResult | null> {
    const { pointerPx, plotRect, viewport, priceStep } = params;

    if (plotRect.width <= 0 || plotRect.height <= 0) {
      return null;
    }
    // Hovering inside the right-hand Y-axis panel is not a cell hit —
    // `plotRect` excludes the panel so any pointer past its right edge
    // is on the axis label strip, not a heatmap cell.
    if (pointerPx.x < 0 || pointerPx.x > plotRect.width) {
      return null;
    }

    const viewStartMs = viewTimeStartMs(viewport, plotRect.width);
    const viewRangeMs = viewport.viewTimeEndMs - viewStartMs;
    if (viewRangeMs <= 0) {
      return null;
    }
    const priceRange = viewport.priceMax - viewport.priceMin;
    if (priceRange <= 0) {
      return null;
    }

    const pointerTimeMs = (viewStartMs +
      (pointerPx.x / plotRect.width) * viewRangeMs) as UnixTimeMs;
    const pointerPrice = viewport.priceMax - (pointerPx.y / plotRect.height) * priceRange;

    const located = await this.locateSnapshot(pointerTimeMs, { allowNearestEarlier: false });
    if (located === undefined) {
      return null;
    }

    return this.pickLevelAt(located, pointerPrice, priceStep, pointerPx);
  }

  clearCache(): void {
    this.cache.clear();
  }

  dispose(): void {
    this.cache.clear();
  }

  private async locateSnapshot(
    timeMs: UnixTimeMs,
    options: { allowNearestEarlier: boolean }
  ): Promise<ILocatedSnapshot | undefined> {
    const block = this.findBlockForTime(timeMs, options.allowNearestEarlier);
    if (block === undefined) {
      return undefined;
    }

    const source = await this.loadBlockSource(block.blockId);
    if (source === null) {
      return undefined;
    }

    const snapshotIndex = this.findSnapshotIndex(source, timeMs, {
      // Only the "positioning" path (allowNearestEarlier=true) falls
      // back to the latest snapshot when the pointer is beyond the
      // last delta. Hit-test must stay strict — otherwise hovering in
      // a time slot that has no snapshot would still match the
      // nearest-right cell and pop an incorrect tooltip.
      allowFallbackToLast: options.allowNearestEarlier,
    });
    if (snapshotIndex < 0) {
      return undefined;
    }

    return { meta: source.meta, data: source.data, snapshotIndex };
  }

  private findBlockForTime(
    timeMs: UnixTimeMs,
    allowNearestEarlier: boolean
  ): { readonly blockId: UnixTimeMs } | undefined {
    // Every snapshot renders as a 1-cell wide tile centred on its
    // `eventTimeMs` — the shader extends it by `updateSpeedMs / 2` on
    // each side. A block's effective pointer-hit range therefore is
    // `[firstTimestampMs - halfCell, lastTimestampMs + halfCell]`,
    // not the strict `[minX, maxX]` stored in the registry. Hovering
    // on the very first or very last cell of a block falls into this
    // overhang — without the widening the tooltip silently drops on
    // pixels that visibly render. `findSnapshotIndex` already uses
    // the same half-cell tolerance to pick the nearest snapshot, so
    // this keeps the two layers consistent.
    const halfCell = this.updateSpeedMs / 2;
    const widened = this.registry.searchRange(
      (timeMs - halfCell) as UnixTimeMs,
      (timeMs + halfCell) as UnixTimeMs
    );
    if (widened.length > 0) {
      let best: (typeof widened)[number] | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of widened) {
        // Strict containment is the unambiguously correct match — the
        // pointer time really is inside this block's snapshot range.
        if (candidate.minX <= timeMs && candidate.maxX >= timeMs) {
          return candidate;
        }
        // Otherwise pick the block whose nearest endpoint is closest
        // to `timeMs`. Two candidates only show up at the exact touch
        // point between two adjacent blocks, and whichever endpoint
        // the pointer is closer to matches the visual cell the user
        // perceives it hovering over.
        const distance = Math.min(
          Math.abs(candidate.minX - timeMs),
          Math.abs(candidate.maxX - timeMs)
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
      if (best !== undefined) {
        return best;
      }
    }

    if (!allowNearestEarlier) {
      return undefined;
    }
    // Positioning path (Y-axis auto-centering) — when the pointer is
    // past the live edge, fall back to the latest block starting at
    // or before `timeMs`.
    const oldest = this.registry.oldestStartMs();
    if (oldest === undefined) {
      return undefined;
    }
    const earlier = this.registry.searchRange(oldest, timeMs);
    if (earlier.length === 0) {
      return undefined;
    }
    let best = earlier[0];
    for (const candidate of earlier) {
      if (candidate.minX > best.minX) {
        best = candidate;
      }
    }
    return best;
  }

  private async loadBlockSource(blockId: UnixTimeMs): Promise<IActiveBlockSource | null> {
    const activeBlock = this.getActiveBlockSource();
    if (activeBlock !== null && activeBlock.meta.blockId === blockId) {
      return activeBlock;
    }
    const cached = this.cache.get(blockId);
    if (cached !== undefined) {
      return { meta: recordToMeta(cached), data: new Float32Array(cached.data) };
    }
    if (this.db === undefined) {
      return null;
    }
    const record = await this.db.getBlock(blockId);
    if (record === undefined) {
      return null;
    }
    this.cache.put(record);
    return { meta: recordToMeta(record), data: new Float32Array(record.data) };
  }

  /**
   * Linear scan over `count` snapshots by the `timeDelta` stored in
   * every texel's first channel. Snapshots live in arrival order, not
   * wall-clock position, so we find the nearest by delta rather than
   * computing an index from `timeMs`.
   *
   * Tolerance is `updateSpeedMs / 2` — half a snapshot interval,
   * matching the on-screen cell width. A pointer further from the
   * nearest snapshot than half a cell is considered to be in an
   * empty time slot and returns `-1`.
   *
   * `allowFallbackToLast: true` makes the function also return the
   * latest snapshot when the pointer is past the last `timeDelta` —
   * used by the Y-axis positioning path so follow-mode's future
   * padding still gets a usable mid.
   */
  private findSnapshotIndex(
    source: IActiveBlockSource,
    timeMs: UnixTimeMs,
    options: { allowFallbackToLast: boolean }
  ): number {
    const targetDelta = timeMs - source.meta.firstTimestampMs;
    let bestIndex = -1;
    let bestDelta: number = this.updateSpeedMs / 2;
    for (let candidate = 0; candidate < source.meta.count; candidate++) {
      const candidateOffset = candidate * this.snapshotSlots * FLOATS_PER_TEXEL;
      const diff = Math.abs(source.data[candidateOffset] - targetDelta);
      if (diff < bestDelta) {
        bestDelta = diff;
        bestIndex = candidate;
      }
    }
    if (bestIndex >= 0) {
      return bestIndex;
    }
    if (options.allowFallbackToLast && source.meta.count > 0 && targetDelta >= 0) {
      return source.meta.count - 1;
    }
    return -1;
  }

  private reconstructSnapshot(located: ILocatedSnapshot): IOrderbookSnapshot {
    const { meta, data, snapshotIndex } = located;
    const base = snapshotIndex * this.snapshotSlots * FLOATS_PER_TEXEL;
    const bids: Array<readonly [number, number]> = [];
    const asks: Array<readonly [number, number]> = [];
    for (let levelIndex = 0; levelIndex < this.depth; levelIndex++) {
      const offset = base + levelIndex * FLOATS_PER_TEXEL;
      const volume = data[offset + 2];
      if (volume > 0) {
        bids.push([data[offset + 1], volume]);
      }
    }
    for (let levelIndex = 0; levelIndex < this.depth; levelIndex++) {
      const offset = base + (this.depth + levelIndex) * FLOATS_PER_TEXEL;
      const volume = data[offset + 2];
      if (volume > 0) {
        asks.push([data[offset + 1], volume]);
      }
    }
    return {
      eventTimeMs: (meta.firstTimestampMs + data[base]) as UnixTimeMs,
      bids,
      asks,
    };
  }

  private pickLevelAt(
    located: ILocatedSnapshot,
    pointerPrice: number,
    priceStep: number,
    pointerPx: { readonly x: number; readonly y: number }
  ): IHitTestResult | null {
    const { meta, data, snapshotIndex } = located;
    const base = snapshotIndex * this.snapshotSlots * FLOATS_PER_TEXEL;
    const tolerance = priceStep / 2;
    let bestLevel = -1;
    let bestDelta = tolerance;

    for (let levelIndex = 0; levelIndex < this.snapshotSlots; levelIndex++) {
      const offset = base + levelIndex * FLOATS_PER_TEXEL;
      const volume = data[offset + 2];
      if (volume <= 0) {
        continue;
      }
      const delta = Math.abs(data[offset + 1] - pointerPrice);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestLevel = levelIndex;
      }
    }

    if (bestLevel < 0) {
      return null;
    }

    const cellOffset = base + bestLevel * FLOATS_PER_TEXEL;
    // Every texel's first channel carries this snapshot's real
    // `timeDelta` — snapshots live in arrival order, not wall-clock
    // position, so we must read the stored delta instead of
    // multiplying the arrival index by `updateSpeedMs`. The vertex
    // shader reads the same channel for X positioning, keeping the
    // tooltip aligned with what the user actually sees.
    return {
      blockId: meta.blockId,
      timestampMs: (meta.firstTimestampMs + data[base]) as UnixTimeMs,
      price: data[cellOffset + 1],
      volume: data[cellOffset + 2],
      side: determineSide(bestLevel, this.depth),
      pointerPx,
    };
  }
}

function determineSide(levelIndex: number, depth: number): 'bid' | 'ask' | 'padding' {
  if (levelIndex < depth) {
    return 'bid';
  }
  if (levelIndex < 2 * depth) {
    return 'ask';
  }
  return 'padding';
}

function recordToMeta(record: IOrderbookBlockRecord): IBlockMeta {
  return {
    blockId: record.blockId,
    firstTimestampMs: record.firstTimestampMs,
    lastTimestampMs: record.lastTimestampMs,
    count: record.count,
    textureRowIndex: record.textureRowIndex,
  };
}

/**
 * Recency-ordered LRU cache for `IOrderbookBlockRecord`. Accessing a
 * key moves it to the most-recent position; `put` evicts the oldest
 * entry when the cache is full.
 */
class BlockRecordLruCache {
  private readonly entries = new Map<UnixTimeMs, IOrderbookBlockRecord>();
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(blockId: UnixTimeMs): IOrderbookBlockRecord | undefined {
    const record = this.entries.get(blockId);
    if (record !== undefined) {
      this.entries.delete(blockId);
      this.entries.set(blockId, record);
    }
    return record;
  }

  put(record: IOrderbookBlockRecord): void {
    if (this.entries.has(record.blockId)) {
      this.entries.delete(record.blockId);
    } else if (this.entries.size >= this.capacity) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
    this.entries.set(record.blockId, record);
  }

  clear(): void {
    this.entries.clear();
  }
}
