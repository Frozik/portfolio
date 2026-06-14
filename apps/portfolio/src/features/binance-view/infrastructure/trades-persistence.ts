import type { IBinanceDb } from '../domain/binance-db';
import type { ITrade } from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';
import type { ITradeBlockFlushEvent } from './trade-bucket-accumulator';

/**
 * Copy-on-write: the accumulator owns `event.data` and may keep
 * mutating it for subsequent buckets in the active block, so we
 * snapshot the bytes into a fresh `ArrayBuffer` before handing it to
 * IndexedDB's structured clone. Mirrors `OrderbookStreamStore.persistFlushedBlock`.
 */
export async function persistAggregateBlock(
  db: IBinanceDb,
  event: ITradeBlockFlushEvent
): Promise<void> {
  const dataCopy = new ArrayBuffer(event.data.byteLength);
  new Uint8Array(dataCopy).set(
    new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
  );
  try {
    await db.trades.putBlock({
      blockId: event.block.blockId,
      firstBucketStartMs: event.block.firstBucketStartMs,
      lastBucketStartMs: event.block.lastBucketStartMs,
      basePrice: event.block.basePrice,
      bucketCount: event.block.bucketCount,
      textureRowIndex: event.block.textureRowIndex,
      data: dataCopy,
    });
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surfaces quota-exceeded / IDB write failure
    console.warn('binance-view: IDB trade-block putBlock failed', error);
  }
}

/**
 * Snapshot raw trades for the just-rotated block. The accumulator
 * hands off bucket arrays by reference — once the block has rotated
 * it never mutates them again, but we still copy each bucket's
 * trades to keep the persisted record decoupled from the in-RAM
 * cache (the popup may evict the cache mid-write, and IDB's
 * structured-clone serializer must observe a stable shape).
 */
export async function persistRawTrades(
  db: IBinanceDb,
  event: ITradeBlockFlushEvent
): Promise<void> {
  const bucketsRaw = Array.from(event.rawTradesByBucket.entries()).map(
    ([bucketStartMs, trades]) => ({
      bucketStartMs,
      trades: [...trades],
    })
  );
  try {
    await db.trades.putRawTrades({
      blockId: event.block.blockId,
      bucketsRaw,
    });
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surfaces quota-exceeded / IDB write failure
    console.warn('binance-view: IDB trade-buckets-raw putRawTrades failed', error);
  }
}

/**
 * Read raw trades for `blockId` from IndexedDB and rebuild the
 * `bucketStartMs → ITrade[]` map. Returns `undefined` when the record
 * is missing or the read fails. Caller is responsible for the
 * reload-token race guard and the observable mutation that publishes
 * the result.
 */
export async function loadRawTradesFromDb(
  db: IBinanceDb,
  blockId: UnixTimeMs
): Promise<Map<UnixTimeMs, ITrade[]> | undefined> {
  try {
    const record = await db.trades.getRawTrades(blockId);
    if (record === undefined) {
      return undefined;
    }
    const bucketMap = new Map<UnixTimeMs, ITrade[]>();
    for (const { bucketStartMs, trades } of record.bucketsRaw) {
      bucketMap.set(bucketStartMs, [...trades]);
    }
    return bucketMap;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surfaces lazy-load IDB failure
    console.warn('binance-view: IDB lazy reload failed', error);
    return undefined;
  }
}
