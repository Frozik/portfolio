import type { BlockSpatialIndex } from './block-store/block-spatial-index';
import { BUCKET_DURATION_MS, FLOATS_PER_BUCKET } from './trades-constants';
import type { ITradeBlockIndexItem, ITradeBucket, ITradeBucketHitTestResult } from './trades-types';
import type { UnixTimeMs } from './types';

export type TradesIndex = BlockSpatialIndex<ITradeBlockIndexItem>;

/**
 * Pointer over the volume panel, built by the presentation layer from a
 * pointer event and the canvas geometry (`presentation/build-trade-hit-test-pointer.ts`).
 */
export interface ITradeHitTestPointer {
  readonly worldTimeMs: UnixTimeMs;
  /** Pointer position in CSS pixels relative to the canvas top-left. */
  readonly pointerPx: { readonly x: number; readonly y: number };
}

/**
 * Every bucket whose one-second slot contains the pointer time. A bar's
 * height plays no part, so a tiny bar is as easy to reach as a tall one.
 * Callers pick among the candidates with {@link pickMostRecentBucket}.
 */
export function findBucketsAt(
  pointer: ITradeHitTestPointer,
  tradesIndex: TradesIndex,
  blockData: ReadonlyMap<UnixTimeMs, Float32Array>
): readonly ITradeBucketHitTestResult[] {
  const items = tradesIndex.searchRange(
    (pointer.worldTimeMs - BUCKET_DURATION_MS) as UnixTimeMs,
    pointer.worldTimeMs
  );
  const hits: ITradeBucketHitTestResult[] = [];
  for (const item of items) {
    const data = blockData.get(item.blockId);
    if (data === undefined) {
      continue;
    }
    for (let bucketIndex = 0; bucketIndex < item.bucketCount; bucketIndex++) {
      const bucket = decodeBucket(item, data, bucketIndex);
      const isInsideSlot =
        pointer.worldTimeMs >= bucket.bucketStartMs &&
        pointer.worldTimeMs < bucket.bucketStartMs + BUCKET_DURATION_MS;
      if (isInsideSlot) {
        hits.push({
          blockId: item.blockId,
          bucketStartMs: bucket.bucketStartMs,
          bucket,
          pointerPx: pointer.pointerPx,
        });
      }
    }
  }
  return hits;
}

/** The bucket starting exactly at `targetStartMs`; `undefined` once its block left RAM. */
export function decodeBucketAt(
  targetStartMs: UnixTimeMs,
  tradesIndex: TradesIndex,
  blockData: ReadonlyMap<UnixTimeMs, Float32Array>
): ITradeBucket | undefined {
  for (const item of tradesIndex.searchRange(targetStartMs, targetStartMs)) {
    const data = blockData.get(item.blockId);
    if (data === undefined) {
      continue;
    }
    for (let bucketIndex = 0; bucketIndex < item.bucketCount; bucketIndex++) {
      const bucket = decodeBucket(item, data, bucketIndex);
      if (bucket.bucketStartMs === targetStartMs) {
        return bucket;
      }
    }
  }
  return undefined;
}

function decodeBucket(
  item: ITradeBlockIndexItem,
  data: Float32Array,
  bucketIndex: number
): ITradeBucket {
  const offset = bucketIndex * FLOATS_PER_BUCKET;
  return {
    bucketStartMs: (item.minX + data[offset]) as UnixTimeMs,
    vwap: item.basePrice + data[offset + 1],
    volumeTotal: data[offset + 2],
    buyFraction: data[offset + 3],
  };
}

/** Most-recent bucket of a candidate list; `undefined` for an empty list. */
export function pickMostRecentBucket(
  candidates: readonly ITradeBucketHitTestResult[]
): ITradeBucketHitTestResult | undefined {
  let best: ITradeBucketHitTestResult | undefined;
  for (const candidate of candidates) {
    if (best === undefined || candidate.bucketStartMs > best.bucketStartMs) {
      best = candidate;
    }
  }
  return best;
}
