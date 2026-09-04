import { describe, expect, it } from 'vitest';

import { RawTradesCache } from './raw-trades-cache';
import type { ITrade, Quantity, TradeId } from './trades-types';
import type { UnixTimeMs } from './types';

const BLOCK_A = 1_000 as UnixTimeMs;
const BLOCK_B = 2_000 as UnixTimeMs;
const BLOCK_C = 3_000 as UnixTimeMs;

function trade(tradeId: number): ITrade {
  return {
    tradeId: tradeId as TradeId,
    eventTimeMs: BLOCK_A,
    price: 100,
    quantity: 1 as Quantity,
    isBuyerMaker: false,
  };
}

function buckets(tradeId: number): ReadonlyMap<UnixTimeMs, readonly ITrade[]> {
  return new Map([[BLOCK_A, [trade(tradeId)]]]);
}

describe('RawTradesCache', () => {
  it('returns the trades of a cached bucket and undefined for unknown keys', () => {
    const cache = new RawTradesCache(2);
    cache.set(BLOCK_A, buckets(1));

    expect(cache.get(BLOCK_A, BLOCK_A)?.[0]?.tradeId).toBe(1);
    expect(cache.get(BLOCK_B, BLOCK_A)).toBeUndefined();
  });

  it('evicts the oldest block once more than `capacity` blocks are cached', () => {
    const cache = new RawTradesCache(2);
    cache.set(BLOCK_A, buckets(1));
    cache.set(BLOCK_B, buckets(2));
    cache.set(BLOCK_C, buckets(3));

    expect(cache.has(BLOCK_A)).toBe(false);
    expect(cache.has(BLOCK_B)).toBe(true);
    expect(cache.has(BLOCK_C)).toBe(true);
  });

  it('keeps a re-flushed block at its original queue position', () => {
    const cache = new RawTradesCache(2);
    cache.set(BLOCK_A, buckets(1));
    cache.set(BLOCK_B, buckets(2));
    cache.set(BLOCK_A, buckets(4));
    cache.set(BLOCK_C, buckets(3));

    expect(cache.has(BLOCK_A)).toBe(false);
    expect(cache.get(BLOCK_B, BLOCK_A)?.[0]?.tradeId).toBe(2);
  });
});
