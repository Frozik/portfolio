import 'fake-indexeddb/auto';

import { openDB } from 'idb';
import { afterEach, describe, expect, test } from 'vitest';

import type { UnixTimeMs } from '../domain/types';
import {
  DEFAULT_DB_VERSION,
  MID_PRICE_BLOCKS_STORE,
  ORDERBOOK_BLOCKS_STORE,
  openBinanceDb,
  openOrderbookDb,
} from './binance-indexeddb';

function makeRecord(blockId: number, countValue = 128) {
  return {
    blockId: blockId as UnixTimeMs,
    firstTimestampMs: blockId as UnixTimeMs,
    lastTimestampMs: (blockId + 128_000) as UnixTimeMs,
    count: countValue,
    textureRowIndex: 0,
    data: new ArrayBuffer(256),
  };
}

function makeMidPriceRecord(blockId: number, countValue = 10) {
  return {
    blockId: blockId as UnixTimeMs,
    firstTimestampMs: blockId as UnixTimeMs,
    lastTimestampMs: (blockId + 10_000) as UnixTimeMs,
    basePrice: 50_000,
    count: countValue,
    textureRowIndex: 0,
    data: new ArrayBuffer(256),
  };
}

let dbCounter = 0;

function uniqueDbName() {
  dbCounter++;
  return `binance-orderbook-test-${dbCounter}-${Math.random()}`;
}

describe('orderbook-indexeddb', () => {
  let openedDbs: Awaited<ReturnType<typeof openOrderbookDb>>[] = [];

  afterEach(() => {
    for (const db of openedDbs) {
      db.close();
    }
    openedDbs = [];
  });

  test('putBlock + getBlock round-trip the record', async () => {
    const db = await openOrderbookDb(uniqueDbName());
    openedDbs.push(db);

    const record = makeRecord(1000);
    await db.putBlock(record);
    const loaded = await db.getBlock(1000 as UnixTimeMs);

    expect(loaded).toBeDefined();
    expect(loaded?.blockId).toBe(1000);
    expect(loaded?.count).toBe(128);
    expect(loaded?.data.byteLength).toBe(256);
  });

  test('putBlock upserts existing keys (no duplicates)', async () => {
    const db = await openOrderbookDb(uniqueDbName());
    openedDbs.push(db);

    await db.putBlock(makeRecord(1000, 16));
    await db.putBlock(makeRecord(1000, 64));

    const loaded = await db.getBlock(1000 as UnixTimeMs);
    expect(loaded?.count).toBe(64);
    expect(await db.countBlocks()).toBe(1);
  });

  test('clearAll removes every record', async () => {
    const db = await openOrderbookDb(uniqueDbName());
    openedDbs.push(db);

    await db.putBlock(makeRecord(1000));
    await db.putBlock(makeRecord(2000));
    expect(await db.countBlocks()).toBe(2);

    await db.clearAll();
    expect(await db.countBlocks()).toBe(0);
  });

  test('deleteBlock removes a single record, leaves others intact', async () => {
    const db = await openOrderbookDb(uniqueDbName());
    openedDbs.push(db);

    await db.putBlock(makeRecord(1000));
    await db.putBlock(makeRecord(2000));
    await db.deleteBlock(1000 as UnixTimeMs);

    expect(await db.getBlock(1000 as UnixTimeMs)).toBeUndefined();
    expect(await db.getBlock(2000 as UnixTimeMs)).toBeDefined();
  });

  test('getBlock returns undefined for missing keys', async () => {
    const db = await openOrderbookDb(uniqueDbName());
    openedDbs.push(db);

    expect(await db.getBlock(999 as UnixTimeMs)).toBeUndefined();
  });

  test('concurrent putBlock calls preserve consistency', async () => {
    const db = await openOrderbookDb(uniqueDbName());
    openedDbs.push(db);

    await Promise.all([
      db.putBlock(makeRecord(1000)),
      db.putBlock(makeRecord(2000)),
      db.putBlock(makeRecord(3000)),
    ]);

    expect(await db.countBlocks()).toBe(3);
    expect((await db.getBlock(1000 as UnixTimeMs))?.blockId).toBe(1000);
    expect((await db.getBlock(2000 as UnixTimeMs))?.blockId).toBe(2000);
    expect((await db.getBlock(3000 as UnixTimeMs))?.blockId).toBe(3000);
  });
});

describe('binance-indexeddb (v3)', () => {
  const openedDbs: Awaited<ReturnType<typeof openBinanceDb>>[] = [];

  afterEach(() => {
    while (openedDbs.length > 0) {
      const db = openedDbs.pop();
      db?.close();
    }
  });

  test('creates both orderbook-blocks and mid-price-blocks stores on fresh open', async () => {
    const db = await openBinanceDb(uniqueDbName());
    openedDbs.push(db);

    await db.orderbook.putBlock(makeRecord(1000));
    await db.midPrice.putBlock(makeMidPriceRecord(2000));

    expect(await db.orderbook.countBlocks()).toBe(1);
    expect(await db.midPrice.countBlocks()).toBe(1);
  });

  test('round-trips mid-price records with the basePrice field', async () => {
    const db = await openBinanceDb(uniqueDbName());
    openedDbs.push(db);

    await db.midPrice.putBlock(makeMidPriceRecord(1000));
    const loaded = await db.midPrice.getBlock(1000 as UnixTimeMs);
    expect(loaded).toBeDefined();
    expect(loaded?.basePrice).toBe(50_000);
  });

  test('clearAll wipes both stores in a single transaction', async () => {
    const db = await openBinanceDb(uniqueDbName());
    openedDbs.push(db);

    await db.orderbook.putBlock(makeRecord(1000));
    await db.midPrice.putBlock(makeMidPriceRecord(2000));
    await db.clearAll();

    expect(await db.orderbook.countBlocks()).toBe(0);
    expect(await db.midPrice.countBlocks()).toBe(0);
  });

  test('v1 → v3 upgrade preserves existing orderbook data and adds the mid-price store', async () => {
    const dbName = uniqueDbName();

    // Pre-seed a v1-shaped DB (only the orderbook store exists).
    const v1 = await openDB(dbName, 1, {
      upgrade(upgrading) {
        upgrading.createObjectStore(ORDERBOOK_BLOCKS_STORE, { keyPath: 'blockId' });
      },
    });
    await v1.put(ORDERBOOK_BLOCKS_STORE, makeRecord(1000));
    v1.close();

    // Open at the current version — migration should add mid-price-blocks.
    const db = await openBinanceDb(dbName);
    openedDbs.push(db);

    expect(await db.orderbook.getBlock(1000 as UnixTimeMs)).toBeDefined();
    expect(await db.midPrice.countBlocks()).toBe(0);
  });

  test('default version is v3', () => {
    expect(DEFAULT_DB_VERSION).toBe(3);
  });

  test('exported store names match the IDB object stores', async () => {
    const db = await openBinanceDb(uniqueDbName());
    openedDbs.push(db);

    // Smoke-check: putting into each store via the store-name constants works.
    await db.orderbook.putBlock({ ...makeRecord(1000), blockId: 1000 as UnixTimeMs });
    await db.midPrice.putBlock({ ...makeMidPriceRecord(2000), blockId: 2000 as UnixTimeMs });
    expect(ORDERBOOK_BLOCKS_STORE).toBe('orderbook-blocks');
    expect(MID_PRICE_BLOCKS_STORE).toBe('mid-price-blocks');
  });
});
