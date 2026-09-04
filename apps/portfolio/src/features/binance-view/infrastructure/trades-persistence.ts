import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';

import type { ITradesDb } from '../domain/binance-db';
import type { ITradeBlockFlushEvent } from '../domain/flush-events';
import type { RawTradesByBucket } from '../domain/raw-trades-cache';
import type { UnixTimeMs } from '../domain/types';

export type RawTradesLoadResult =
  | { readonly kind: 'loaded'; readonly buckets: RawTradesByBucket }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failed'; readonly reason: ValueDescriptorFail };

/**
 * Copy-on-write: the accumulator keeps mutating `event.data` for later
 * buckets of the active block, so the bytes are snapshotted before
 * IndexedDB's structured clone sees them.
 */
export async function persistAggregateBlock(
  db: ITradesDb,
  event: ITradeBlockFlushEvent
): Promise<ValueDescriptorFail | undefined> {
  const dataCopy = new ArrayBuffer(event.data.byteLength);
  new Uint8Array(dataCopy).set(
    new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
  );
  try {
    await db.putBlock({
      blockId: event.block.blockId,
      firstBucketStartMs: event.block.firstBucketStartMs,
      lastBucketStartMs: event.block.lastBucketStartMs,
      basePrice: event.block.basePrice,
      bucketCount: event.block.bucketCount,
      data: dataCopy,
    });
    return undefined;
  } catch (error) {
    return toFail(error);
  }
}

/** Persists the sealed block's raw trades; copied so the record is decoupled from the RAM cache. */
export async function persistRawTrades(
  db: ITradesDb,
  event: ITradeBlockFlushEvent
): Promise<ValueDescriptorFail | undefined> {
  const bucketsRaw = Array.from(event.rawTradesByBucket.entries()).map(
    ([bucketStartMs, trades]) => ({ bucketStartMs, trades: [...trades] })
  );
  try {
    await db.putRawTrades({ blockId: event.block.blockId, bucketsRaw });
    return undefined;
  } catch (error) {
    return toFail(error);
  }
}

export async function loadRawTradesFromDb(
  db: ITradesDb,
  blockId: UnixTimeMs
): Promise<RawTradesLoadResult> {
  try {
    const record = await db.getRawTrades(blockId);
    if (record === undefined) {
      return { kind: 'missing' };
    }
    const buckets = new Map(
      record.bucketsRaw.map(({ bucketStartMs, trades }) => [bucketStartMs, trades] as const)
    );
    return { kind: 'loaded', buckets };
  } catch (error) {
    return { kind: 'failed', reason: toFail(error) };
  }
}
