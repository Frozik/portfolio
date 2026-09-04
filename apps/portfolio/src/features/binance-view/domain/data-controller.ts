import type { Milliseconds } from '@frozik/utils/date/types';

import type { IOrderbookBlockRecord, IOrderbookDb } from './binance-db';
import { BlockRecordLruCache } from './block-record-lru-cache';
import type { BlockSpatialIndex } from './block-store/block-spatial-index';
import type { IHeatmapBlockIndexItem } from './block-store/create-heatmap-block-index';
import { FLOATS_PER_TEXEL } from './constants';

import type {
  IBlockMeta,
  IHeatmapViewport,
  IHitTestResult,
  IOrderbookSnapshot,
  UnixTimeMs,
} from './types';
import { viewTimeStartMs } from './viewport';

type BlockRegistry = BlockSpatialIndex<IHeatmapBlockIndexItem>;

export interface IActiveBlockSource {
  readonly meta: IBlockMeta;
  readonly data: Float32Array;
}

export interface IDataControllerParams {
  readonly registry: BlockRegistry;
  readonly db: IOrderbookDb | undefined;
  readonly getActiveBlock: () => IActiveBlockSource | undefined;
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
   * that fall in the Y-axis panel (x > width) resolve to `undefined`.
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
 * Sole owner of snapshot lookups: active-block fast path, in-memory LRU
 * cache of historical blocks, and async IndexedDB read-through. Callers
 * receive a reconstructed `IOrderbookSnapshot` whatever the source was.
 */
export class DataController {
  private readonly registry: BlockRegistry;
  private readonly db: IOrderbookDb | undefined;
  private readonly getActiveBlockSource: () => IActiveBlockSource | undefined;
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

  /** Most recent snapshot at or before `timeMs`; falls back to the nearest earlier block. */
  async resolveSnapshotAt(timeMs: UnixTimeMs): Promise<IOrderbookSnapshot | undefined> {
    const located = await this.locateSnapshot(timeMs, { allowNearestEarlier: true });
    if (located === undefined) {
      return undefined;
    }
    return this.reconstructSnapshot(located);
  }

  /** Resolves the price-level cell under a pointer; strict containment, no nearest-block fallback. */
  async resolveCellAt(params: IResolveCellParams): Promise<IHitTestResult | undefined> {
    const { pointerPx, plotRect, viewport, priceStep } = params;

    if (plotRect.width <= 0 || plotRect.height <= 0) {
      return undefined;
    }
    const isInsidePlot =
      pointerPx.x >= 0 &&
      pointerPx.x <= plotRect.width &&
      pointerPx.y >= 0 &&
      pointerPx.y <= plotRect.height;
    if (!isInsidePlot) {
      return undefined;
    }

    const viewStartMs = viewTimeStartMs(viewport, plotRect.width);
    const viewRangeMs = viewport.viewTimeEndMs - viewStartMs;
    if (viewRangeMs <= 0) {
      return undefined;
    }
    const priceRange = viewport.priceMax - viewport.priceMin;
    if (priceRange <= 0) {
      return undefined;
    }

    const pointerTimeMs = (viewStartMs +
      (pointerPx.x / plotRect.width) * viewRangeMs) as UnixTimeMs;
    const pointerPrice = viewport.priceMax - (pointerPx.y / plotRect.height) * priceRange;

    const located = await this.locateSnapshot(pointerTimeMs, { allowNearestEarlier: false });
    if (located === undefined) {
      return undefined;
    }

    return this.pickLevelAt(located, pointerPrice, priceStep, pointerPx);
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
    if (source === undefined) {
      return undefined;
    }

    const snapshotIndex = this.findSnapshotIndex(source, timeMs, {
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
    // A snapshot tile extends `updateSpeedMs / 2` on each side of its timestamp,
    // so a block is hit half a cell beyond its stored `[minX, maxX]`.
    const halfCell = this.updateSpeedMs / 2;
    const widened = this.registry.searchRange(
      (timeMs - halfCell) as UnixTimeMs,
      (timeMs + halfCell) as UnixTimeMs
    );
    if (widened.length > 0) {
      let best: (typeof widened)[number] | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of widened) {
        if (candidate.minX <= timeMs && candidate.maxX >= timeMs) {
          return candidate;
        }
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

  private async loadBlockSource(blockId: UnixTimeMs): Promise<IActiveBlockSource | undefined> {
    const activeBlock = this.getActiveBlockSource();
    if (activeBlock !== undefined && activeBlock.meta.blockId === blockId) {
      return activeBlock;
    }
    const cached = this.cache.get(blockId);
    if (cached !== undefined) {
      return { meta: recordToMeta(cached), data: new Float32Array(cached.data) };
    }
    if (this.db === undefined) {
      return undefined;
    }
    const record = await this.db.getBlock(blockId);
    if (record === undefined) {
      return undefined;
    }
    this.cache.put(record);
    return { meta: recordToMeta(record), data: new Float32Array(record.data) };
  }

  /**
   * Snapshots live in arrival order, so the nearest one is found by the
   * `timeDelta` stored in each texel within half a cell; `-1` when the
   * slot is empty. The positioning path may fall back to the last snapshot.
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
  ): IHitTestResult | undefined {
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
      return undefined;
    }

    const cellOffset = base + bestLevel * FLOATS_PER_TEXEL;
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
  };
}
