import type { DBSchema, IDBPDatabase, StoreNames } from 'idb';
import { openDB } from 'idb';

import type { UnixTimeMs } from '../domain/types';

export const DEFAULT_DB_NAME = 'binance-orderbook';
/**
 * Schema version. History:
 *
 *   v1 — only `orderbook-blocks`.
 *   v2 — added a sibling store for the price-line overlay. It was
 *        originally named `avg-price-blocks` (when the overlay pulled
 *        from Binance's `@avgPrice` stream); after the refactor to
 *        computing mid from `(bestBid + bestAsk) / 2` directly from
 *        orderbook snapshots, the store was renamed to
 *        `mid-price-blocks`.
 *   v3 — drops the old `avg-price-blocks` store (if present on a
 *        returning user's device) and creates `mid-price-blocks`.
 *        Without the bump, users who already had a v2 DB on their
 *        device kept the old store name and `clearAll` threw
 *        "NotFoundError: One of the specified object stores was not
 *        found" as soon as the new code opened a transaction.
 *
 * Bumps MUST stay idempotent: the upgrade handler can fire from any
 * earlier version, so every step recreates stores via the
 * `!contains()` guard and deletes legacy stores only after checking
 * that they exist.
 */
export const DEFAULT_DB_VERSION = 3;
export const ORDERBOOK_BLOCKS_STORE = 'orderbook-blocks';
export const MID_PRICE_BLOCKS_STORE = 'mid-price-blocks';
/**
 * Legacy store name from v2 (when the overlay consumed Binance's
 * `@avgPrice` WebSocket). Retained here only so the v3 upgrade can
 * drop it from returning users' browsers — nothing in the app
 * writes to or reads from it anymore.
 */
const LEGACY_AVG_PRICE_BLOCKS_STORE = 'avg-price-blocks';

/**
 * @deprecated Use {@link ORDERBOOK_BLOCKS_STORE}. Retained as a
 * re-export so legacy imports still compile during the transition;
 * remove once no external module references it.
 */
export const BLOCKS_STORE = ORDERBOOK_BLOCKS_STORE;

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
 * Bundle of per-feature stores inside a single binance IndexedDB.
 * `clearAll` / `close` act on the whole DB — the feature spec calls
 * for a clean slate on every page open so we never have to reason
 * about store-level partial clears.
 */
export interface IBinanceDb {
  readonly orderbook: IOrderbookDb;
  readonly midPrice: IMidPriceDb;
  clearAll(): Promise<void>;
  close(): void;
}

interface IBinanceDbSchema extends DBSchema {
  [ORDERBOOK_BLOCKS_STORE]: {
    key: number;
    value: IOrderbookBlockRecord;
  };
  [MID_PRICE_BLOCKS_STORE]: {
    key: number;
    value: IMidPriceBlockRecord;
  };
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

class MidPriceDb implements IMidPriceDb {
  constructor(private readonly db: IDBPDatabase<IBinanceDbSchema>) {}

  async clearAll(): Promise<void> {
    await this.db.clear(MID_PRICE_BLOCKS_STORE);
  }

  async putBlock(record: IMidPriceBlockRecord): Promise<void> {
    await this.db.put(MID_PRICE_BLOCKS_STORE, record);
  }

  async getBlock(blockId: UnixTimeMs): Promise<IMidPriceBlockRecord | undefined> {
    return this.db.get(MID_PRICE_BLOCKS_STORE, blockId);
  }

  async deleteBlock(blockId: UnixTimeMs): Promise<void> {
    await this.db.delete(MID_PRICE_BLOCKS_STORE, blockId);
  }

  async countBlocks(): Promise<number> {
    return this.db.count(MID_PRICE_BLOCKS_STORE);
  }
}

/**
 * Open (or upgrade-and-open) the Binance IndexedDB used by the
 * orderbook + mid-price features. Upgrade handler is additive
 * only — it never drops a store — so v1 data (orderbook-only)
 * upgrades cleanly to v2 without losing anything on disk. Clearing is
 * done explicitly by callers via `clearAll()`.
 */
export async function openBinanceDb(
  dbName: string = DEFAULT_DB_NAME,
  dbVersion: number = DEFAULT_DB_VERSION
): Promise<IBinanceDb> {
  const db = await openDB<IBinanceDbSchema>(dbName, dbVersion, {
    upgrade(upgrading) {
      if (!upgrading.objectStoreNames.contains(ORDERBOOK_BLOCKS_STORE)) {
        upgrading.createObjectStore(ORDERBOOK_BLOCKS_STORE, { keyPath: 'blockId' });
      }
      if (!upgrading.objectStoreNames.contains(MID_PRICE_BLOCKS_STORE)) {
        upgrading.createObjectStore(MID_PRICE_BLOCKS_STORE, { keyPath: 'blockId' });
      }
      // v3 migration: the overlay store was renamed from
      // `avg-price-blocks` to `mid-price-blocks`. Returning users
      // would otherwise keep the legacy store forever and the
      // `clearAll` transaction below would still reference the new
      // name that doesn't exist on their device. Deletion is
      // idempotent (`contains` guard), so re-running the upgrade is
      // safe. The schema type `IBinanceDbSchema` describes *current*
      // stores only — we widen the legacy name to the idb-typed
      // `StoreNames` union so `deleteObjectStore` accepts it; at
      // runtime it's just a string and both APIs accept any string.
      const legacyStoreName = LEGACY_AVG_PRICE_BLOCKS_STORE as StoreNames<IBinanceDbSchema>;
      if (upgrading.objectStoreNames.contains(legacyStoreName)) {
        upgrading.deleteObjectStore(legacyStoreName);
      }
    },
  });

  const orderbook = new OrderbookDb(db);
  const midPrice = new MidPriceDb(db);

  return {
    orderbook,
    midPrice,
    async clearAll() {
      const tx = db.transaction([ORDERBOOK_BLOCKS_STORE, MID_PRICE_BLOCKS_STORE], 'readwrite');
      await Promise.all([
        tx.objectStore(ORDERBOOK_BLOCKS_STORE).clear(),
        tx.objectStore(MID_PRICE_BLOCKS_STORE).clear(),
      ]);
      await tx.done;
    },
    close() {
      db.close();
    },
  };
}

/**
 * @deprecated Prefer {@link openBinanceDb} — returns the orderbook-only
 * view into the full Binance DB for existing callers that haven't
 * migrated yet. Same lifetime semantics as before; `close()` closes
 * the shared underlying database.
 */
export async function openOrderbookDb(
  dbName: string = DEFAULT_DB_NAME,
  dbVersion: number = DEFAULT_DB_VERSION
): Promise<IOrderbookDb> {
  const binance = await openBinanceDb(dbName, dbVersion);
  return {
    clearAll: () => binance.orderbook.clearAll(),
    putBlock: record => binance.orderbook.putBlock(record),
    getBlock: blockId => binance.orderbook.getBlock(blockId),
    deleteBlock: blockId => binance.orderbook.deleteBlock(blockId),
    countBlocks: () => binance.orderbook.countBlocks(),
    close: () => binance.close(),
  };
}
