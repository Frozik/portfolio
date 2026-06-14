import type { ITradeBlockRecord, ITradeBucketRawRecord } from './trades-types';
import type { UnixTimeMs } from './types';

/**
 * Persistence DTOs and repository ports for the binance-view IndexedDB.
 *
 * These are domain-owned contracts (the bridge-type pattern, mirroring
 * `trades-types.ts`): the domain's data/LRU controllers depend only on these
 * interfaces, and `infrastructure/binance-indexeddb.ts` provides the concrete
 * `idb`-backed implementation. Keeping the records and the `I*Db` ports here
 * is what lets the domain stay free of any `infrastructure/` import.
 */

export interface IOrderbookBlockRecord {
  readonly blockId: UnixTimeMs;
  readonly firstTimestampMs: UnixTimeMs;
  readonly lastTimestampMs: UnixTimeMs;
  readonly count: number;
  readonly textureRowIndex: number | undefined;
  readonly data: ArrayBuffer;
}

export interface IMidPriceBlockRecord {
  readonly blockId: UnixTimeMs;
  readonly firstTimestampMs: UnixTimeMs;
  readonly lastTimestampMs: UnixTimeMs;
  readonly basePrice: number;
  readonly count: number;
  readonly textureRowIndex: number | undefined;
  readonly data: ArrayBuffer;
}

export interface IOrderbookDb {
  clearAll(): Promise<void>;
  putBlock(record: IOrderbookBlockRecord): Promise<void>;
  getBlock(blockId: UnixTimeMs): Promise<IOrderbookBlockRecord | undefined>;
  deleteBlock(blockId: UnixTimeMs): Promise<void>;
  countBlocks(): Promise<number>;
  close(): void;
}

export interface IMidPriceDb {
  clearAll(): Promise<void>;
  putBlock(record: IMidPriceBlockRecord): Promise<void>;
  getBlock(blockId: UnixTimeMs): Promise<IMidPriceBlockRecord | undefined>;
  deleteBlock(blockId: UnixTimeMs): Promise<void>;
  countBlocks(): Promise<number>;
}

/**
 * Repository for the trades layer. Mirrors {@link IOrderbookDb}'s shape but
 * keeps two physically separate stores: `trade-blocks` for per-block aggregate
 * `Float32Array` copies (written every flush — 4 KB per record) and
 * `trade-buckets-raw` for the raw `ITrade` payloads (written only on block
 * rotation — up to ~4 MB per record). The split lets the popup lazy-reload raw
 * trades without dragging in the aggregate row, and the aggregate reload (when a
 * block re-enters the viewport) doesn't pay for the raw payload it doesn't need.
 * See trades.md §3.3.
 */
export interface ITradesDb {
  clearAll(): Promise<void>;
  putBlock(record: ITradeBlockRecord): Promise<void>;
  getBlock(blockId: UnixTimeMs): Promise<ITradeBlockRecord | undefined>;
  deleteBlock(blockId: UnixTimeMs): Promise<void>;
  putRawTrades(record: ITradeBucketRawRecord): Promise<void>;
  getRawTrades(blockId: UnixTimeMs): Promise<ITradeBucketRawRecord | undefined>;
  deleteRawTrades(blockId: UnixTimeMs): Promise<void>;
  countBlocks(): Promise<number>;
}

/**
 * Bundle of per-feature stores inside a single binance IndexedDB. `clearAll` /
 * `close` act on the whole DB — the feature spec calls for a clean slate on
 * every page open so we never have to reason about store-level partial clears.
 */
export interface IBinanceDb {
  readonly orderbook: IOrderbookDb;
  readonly midPrice: IMidPriceDb;
  readonly trades: ITradesDb;
  clearAll(): Promise<void>;
  close(): void;
}
