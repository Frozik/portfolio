import type { DBSchema, IDBPDatabase, StoreNames } from 'idb';
import { openDB } from 'idb';

import type {
  IBinanceDb,
  ICandleDb,
  IOrderbookBlockRecord,
  IOrderbookDb,
  ITradesDb,
} from '../domain/binance-db';
import type { ICandleBlockRecord } from '../domain/candle-types';
import type { ITradeBlockRecord, ITradeBucketRawRecord } from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';

const DEFAULT_DB_NAME = 'binance-orderbook';
/**
 * Schema history: v1 orderbook only; v2 `avg-price-blocks`; v3 renamed it to
 * `mid-price-blocks`; v4 added the two trade stores; v5 replaced the
 * mid-price line with `candle-blocks`. Every step is idempotent (guarded by
 * `contains`) because the upgrade can start from any earlier version.
 */
export const DEFAULT_DB_VERSION = 5;
export const ORDERBOOK_BLOCKS_STORE = 'orderbook-blocks';
export const CANDLE_BLOCKS_STORE = 'candle-blocks';
const TRADE_BLOCKS_STORE = 'trade-blocks';
const TRADE_BUCKETS_RAW_STORE = 'trade-buckets-raw';
/**
 * Store names of earlier schema versions, dropped on upgrade. The schema type
 * only describes current stores, so the legacy names are widened to `StoreNames`.
 */
const LEGACY_STORES: readonly StoreNames<IBinanceDbSchema>[] = [
  'avg-price-blocks' as StoreNames<IBinanceDbSchema>,
  'mid-price-blocks' as StoreNames<IBinanceDbSchema>,
];

interface IBinanceDbSchema extends DBSchema {
  [ORDERBOOK_BLOCKS_STORE]: { key: number; value: IOrderbookBlockRecord };
  [CANDLE_BLOCKS_STORE]: { key: number; value: ICandleBlockRecord };
  [TRADE_BLOCKS_STORE]: { key: number; value: ITradeBlockRecord };
  [TRADE_BUCKETS_RAW_STORE]: { key: number; value: ITradeBucketRawRecord };
}

class OrderbookDb implements IOrderbookDb {
  constructor(private readonly db: IDBPDatabase<IBinanceDbSchema>) {}

  async clearAll(): Promise<void> {
    await this.db.clear(ORDERBOOK_BLOCKS_STORE);
  }

  async putBlock(record: IOrderbookBlockRecord): Promise<void> {
    await this.db.put(ORDERBOOK_BLOCKS_STORE, record);
  }

  async getBlock(blockId: UnixTimeMs): Promise<IOrderbookBlockRecord | undefined> {
    return this.db.get(ORDERBOOK_BLOCKS_STORE, blockId);
  }

  async deleteBlock(blockId: UnixTimeMs): Promise<void> {
    await this.db.delete(ORDERBOOK_BLOCKS_STORE, blockId);
  }

  async countBlocks(): Promise<number> {
    return this.db.count(ORDERBOOK_BLOCKS_STORE);
  }

  close(): void {
    this.db.close();
  }
}

class CandleDb implements ICandleDb {
  constructor(private readonly db: IDBPDatabase<IBinanceDbSchema>) {}

  async clearAll(): Promise<void> {
    await this.db.clear(CANDLE_BLOCKS_STORE);
  }

  async putBlock(record: ICandleBlockRecord): Promise<void> {
    await this.db.put(CANDLE_BLOCKS_STORE, record);
  }

  async getBlock(blockId: UnixTimeMs): Promise<ICandleBlockRecord | undefined> {
    return this.db.get(CANDLE_BLOCKS_STORE, blockId);
  }

  async deleteBlock(blockId: UnixTimeMs): Promise<void> {
    await this.db.delete(CANDLE_BLOCKS_STORE, blockId);
  }

  async countBlocks(): Promise<number> {
    return this.db.count(CANDLE_BLOCKS_STORE);
  }
}

class TradesDb implements ITradesDb {
  constructor(private readonly db: IDBPDatabase<IBinanceDbSchema>) {}

  async clearAll(): Promise<void> {
    await Promise.all([this.db.clear(TRADE_BLOCKS_STORE), this.db.clear(TRADE_BUCKETS_RAW_STORE)]);
  }

  async putBlock(record: ITradeBlockRecord): Promise<void> {
    await this.db.put(TRADE_BLOCKS_STORE, record);
  }

  async getBlock(blockId: UnixTimeMs): Promise<ITradeBlockRecord | undefined> {
    return this.db.get(TRADE_BLOCKS_STORE, blockId);
  }

  async deleteBlock(blockId: UnixTimeMs): Promise<void> {
    await this.db.delete(TRADE_BLOCKS_STORE, blockId);
  }

  async putRawTrades(record: ITradeBucketRawRecord): Promise<void> {
    await this.db.put(TRADE_BUCKETS_RAW_STORE, record);
  }

  async getRawTrades(blockId: UnixTimeMs): Promise<ITradeBucketRawRecord | undefined> {
    return this.db.get(TRADE_BUCKETS_RAW_STORE, blockId);
  }

  async deleteRawTrades(blockId: UnixTimeMs): Promise<void> {
    await this.db.delete(TRADE_BUCKETS_RAW_STORE, blockId);
  }

  async countBlocks(): Promise<number> {
    return this.db.count(TRADE_BLOCKS_STORE);
  }
}

const CURRENT_STORES = [
  ORDERBOOK_BLOCKS_STORE,
  CANDLE_BLOCKS_STORE,
  TRADE_BLOCKS_STORE,
  TRADE_BUCKETS_RAW_STORE,
] as const;

export async function openBinanceDb(
  dbName: string = DEFAULT_DB_NAME,
  dbVersion: number = DEFAULT_DB_VERSION
): Promise<IBinanceDb> {
  const db = await openDB<IBinanceDbSchema>(dbName, dbVersion, {
    upgrade(upgrading) {
      for (const store of CURRENT_STORES) {
        if (!upgrading.objectStoreNames.contains(store)) {
          upgrading.createObjectStore(store, { keyPath: 'blockId' });
        }
      }
      for (const legacyStore of LEGACY_STORES) {
        if (upgrading.objectStoreNames.contains(legacyStore)) {
          upgrading.deleteObjectStore(legacyStore);
        }
      }
    },
  });

  return {
    orderbook: new OrderbookDb(db),
    candles: new CandleDb(db),
    trades: new TradesDb(db),
    async clearAll() {
      const transaction = db.transaction(CURRENT_STORES, 'readwrite');
      await Promise.all(CURRENT_STORES.map(store => transaction.objectStore(store).clear()));
      await transaction.done;
    },
    close() {
      db.close();
    },
  };
}
