import type { BlockSpatialIndex } from './block-store/block-spatial-index';
import {
  DEFAULT_SCALING_MODE,
  FLOATS_PER_BUCKET,
  HIT_AREA_RADIUS_MIN_PX,
  HIT_AREA_RADIUS_PADDING_PX,
  HIT_TOLERANCE_MS,
  RADIUS_MAX_PRICE_TICK_MULT,
  RADIUS_MIN_PRICE_TICK_MULT,
} from './trades-constants';
import type { IViewportStats } from './trades-scaling';
import { computeBucketViewportStats, computeRadiusPx } from './trades-scaling';
import type { ITradeBlockIndexItem, ITradeBucket, ITradeBucketHitTestResult } from './trades-types';
import type { UnixTimeMs } from './types';

export type TradesIndex = BlockSpatialIndex<ITradeBlockIndexItem>;

/**
 * Pointer descriptor consumed by the hit-test resolver. Built by the
 * presentation layer from a React pointer event + canvas geometry
 * (see `presentation/build-trade-hit-test-pointer.ts`). Keeps the
 * resolver independent of the renderer's coordinate-system internals.
 */
export interface ITradeHitTestPointer {
  readonly worldTimeMs: UnixTimeMs;
  /**
   * CSS-px height of one `priceStep` in the current viewport. All
   * pointer fields are in CSS pixels so the resulting hit and the
   * popup / hover-pill DOM positions agree on Retina displays — see
   * `build-trade-hit-test-pointer.ts` for the full rationale.
   */
  readonly priceTickPx: number;
  /**
   * Time-units (ms) per CSS pixel along the X axis at the time of the
   * hit-test. Used to widen the spatial-index search range so a tap
   * landing on the visual edge of a wide whale-bucket still reaches
   * the bucket centre — without this, on narrow viewports the static
   * `HIT_TOLERANCE_MS = 2 s` floor is smaller than the on-screen
   * radius (in time-units) of a max-radius circle and the bucket gets
   * silently filtered out.
   */
  readonly msPerPx: number;
  /** Pointer position in CSS pixels relative to canvas top-left. */
  readonly pointerPx: { readonly x: number; readonly y: number };
  /** Project a world-space point into CSS-px canvas coordinates. */
  readonly worldToPx: (
    timeMs: UnixTimeMs,
    price: number
  ) => { readonly x: number; readonly y: number };
}

/**
 * Collect every bucket whose hit-zone contains the pointer, with no
 * priority applied. Callers layer their own selection rule on top:
 *
 * - **Most-recent wins** — among overlapping circles the active one
 *   is the bucket with the greatest `bucketStartMs`. Newer trades
 *   render last in the renderer (z-lift, see
 *   `TradesLayerRenderer.computeFrameState`) so this priority lines
 *   up with what's visually on top.
 * - **Sticky hover** — once the cursor enters a bucket, the hover
 *   stays on it until the cursor leaves *that bucket's* hit-zone,
 *   even if other circles' zones also cover the pointer.
 *
 * Reuses the renderer's last-frame `IViewportStats` envelope so the
 * hit-zone radii match the rendered radii one-to-one (particularly
 * important in `Log` mode where a divergent local stats pass would
 * produce ghost misses).
 */
export function findBucketsAt(
  pointer: ITradeHitTestPointer,
  tradesIndex: TradesIndex,
  layerStats: IViewportStats | undefined,
  blockData: ReadonlyMap<UnixTimeMs, Float32Array>
): readonly ITradeBucketHitTestResult[] {
  const stats = layerStats ?? computeBucketViewportStats([], DEFAULT_SCALING_MODE);
  const rMinPx = pointer.priceTickPx * RADIUS_MIN_PRICE_TICK_MULT;
  const rMaxPx = pointer.priceTickPx * RADIUS_MAX_PRICE_TICK_MULT;

  // Spatial-index search range must cover the worst-case on-screen
  // radius converted to time. A whale-bucket rendered at the px floor
  // / cap can stretch ~1.5× a price-tick wide; on a narrow mobile
  // viewport that easily exceeds the static `HIT_TOLERANCE_MS = 2 s`
  // floor, and the bucket centre falls outside the index search
  // window — the tap "lands on the circle" visually but the resolver
  // never sees it. Widen tolerance to the bigger of the static floor
  // and the visual envelope so the search is consistent with what
  // the user actually sees.
  const maxHitRadiusPx = Math.max(rMaxPx + HIT_AREA_RADIUS_PADDING_PX, HIT_AREA_RADIUS_MIN_PX);
  const dynamicToleranceMs = maxHitRadiusPx * pointer.msPerPx;
  const toleranceMs = Math.max(HIT_TOLERANCE_MS, dynamicToleranceMs);

  const items = tradesIndex.searchRange(
    (pointer.worldTimeMs - toleranceMs) as UnixTimeMs,
    (pointer.worldTimeMs + toleranceMs) as UnixTimeMs
  );
  if (items.length === 0) {
    return [];
  }

  const hits: ITradeBucketHitTestResult[] = [];
  for (const item of items) {
    const data = blockData.get(item.blockId);
    if (data === undefined) {
      continue;
    }
    for (let bucketIdx = 0; bucketIdx < item.bucketCount; bucketIdx++) {
      const off = bucketIdx * FLOATS_PER_BUCKET;
      const timeDelta = data[off];
      const priceDelta = data[off + 1];
      const volumeTotal = data[off + 2];
      const buyFraction = data[off + 3];
      const bucketStartMs = ((item.minX as UnixTimeMs) + timeDelta) as UnixTimeMs;
      const vwap = item.basePrice + priceDelta;

      const visualRadius = computeRadiusPx(
        volumeTotal,
        stats,
        rMinPx,
        rMaxPx,
        DEFAULT_SCALING_MODE
      );
      // Hit-zone always covers the full auto-scaled visual circle plus
      // a small grace margin — see HIT_AREA_RADIUS_PADDING_PX docstring.
      const hitRadius = Math.max(visualRadius + HIT_AREA_RADIUS_PADDING_PX, HIT_AREA_RADIUS_MIN_PX);
      const center = pointer.worldToPx(bucketStartMs, vwap);
      const dx = pointer.pointerPx.x - center.x;
      const dy = pointer.pointerPx.y - center.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      if (distPx <= hitRadius) {
        hits.push({
          blockId: item.blockId,
          bucketStartMs,
          bucket: { bucketStartMs, vwap, volumeTotal, buyFraction },
          pointerPx: { x: pointer.pointerPx.x, y: pointer.pointerPx.y },
        });
      }
    }
  }
  return hits;
}

/**
 * Pick the most-recent bucket from a candidate list. Returns
 * `undefined` for an empty list. Used by both click and hover so
 * the priority is applied uniformly.
 */
export function pickMostRecentBucket(
  candidates: readonly ITradeBucketHitTestResult[]
): ITradeBucketHitTestResult | undefined {
  let pick: ITradeBucketHitTestResult | undefined;
  let maxStartMs = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.bucketStartMs > maxStartMs) {
      maxStartMs = candidate.bucketStartMs;
      pick = candidate;
    }
  }
  return pick;
}

/**
 * Reconstruct an `ITradeBucket` for the bucket whose start matches
 * `targetStartMs`. Returns `undefined` when no such bucket lives in
 * `blockData` (block was evicted from RAM). Used by the hover pill so
 * the component can render aggregates without re-doing a linear scan.
 */
export function decodeBucketAt(
  targetStartMs: UnixTimeMs,
  tradesIndex: TradesIndex,
  blockData: ReadonlyMap<UnixTimeMs, Float32Array>
): ITradeBucket | undefined {
  const items = tradesIndex.searchRange(targetStartMs, targetStartMs);
  for (const item of items) {
    const data = blockData.get(item.blockId);
    if (data === undefined) {
      continue;
    }
    for (let bucketIdx = 0; bucketIdx < item.bucketCount; bucketIdx++) {
      const off = bucketIdx * FLOATS_PER_BUCKET;
      const timeDelta = data[off];
      const bucketStartMs = ((item.minX as UnixTimeMs) + timeDelta) as UnixTimeMs;
      if (bucketStartMs !== targetStartMs) {
        continue;
      }
      return {
        bucketStartMs,
        vwap: item.basePrice + data[off + 1],
        volumeTotal: data[off + 2],
        buyFraction: data[off + 3],
      };
    }
  }
  return undefined;
}
