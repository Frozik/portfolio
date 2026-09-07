import { isNil } from 'lodash-es';

import type { BlockSpatialIndex } from './block-store/block-spatial-index';
import { decodeCandle } from './candle-encoding';
import type { ICandle, ICandleBlockIndexItem } from './candle-types';
import type { UnixTimeMs } from './types';

export type CandleIndex = BlockSpatialIndex<ICandleBlockIndexItem>;

const CANDLE_DURATION_MS = 1000;

/**
 * Pointer over the price area, in world time. Built by the presentation
 * layer from a pointer event and the canvas geometry.
 */
export interface ICandleHitTestPointer {
  readonly worldTimeMs: UnixTimeMs;
  /** Pointer position in CSS pixels relative to the canvas top-left. */
  readonly pointerPx: { readonly x: number; readonly y: number };
}

/**
 * The candle whose one-second slot contains the pointer time. Height plays
 * no part: a doji is as easy to reach as a tall candle, as with trade
 * buckets. `undefined` when the slot is empty or its block left RAM.
 */
export function findCandleAt(
  pointer: ICandleHitTestPointer,
  candleIndex: CandleIndex,
  blockData: ReadonlyMap<UnixTimeMs, Float32Array>
): ICandle | undefined {
  const items = candleIndex.searchRange(
    (pointer.worldTimeMs - CANDLE_DURATION_MS) as UnixTimeMs,
    pointer.worldTimeMs
  );
  for (const item of items) {
    const data = blockData.get(item.blockId);
    if (isNil(data)) {
      continue;
    }
    for (let candleIndexInBlock = 0; candleIndexInBlock < item.count; candleIndexInBlock++) {
      const candle = decodeCandle(data, item, candleIndexInBlock);
      const isInsideSlot =
        pointer.worldTimeMs >= candle.bucketStartMs &&
        pointer.worldTimeMs < candle.bucketStartMs + CANDLE_DURATION_MS;
      if (isInsideSlot) {
        return candle;
      }
    }
  }
  return undefined;
}

/** The candle starting exactly at `bucketStartMs`; `undefined` once its block left RAM. */
export function decodeCandleAt(
  bucketStartMs: UnixTimeMs,
  candleIndex: CandleIndex,
  blockData: ReadonlyMap<UnixTimeMs, Float32Array>
): ICandle | undefined {
  return findCandleAt(
    { worldTimeMs: bucketStartMs, pointerPx: { x: 0, y: 0 } },
    candleIndex,
    blockData
  );
}
