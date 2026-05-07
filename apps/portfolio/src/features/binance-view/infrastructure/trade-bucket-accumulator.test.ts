import { describe, expect, it } from 'vitest';

import type { ITrade, Quantity, TradeId } from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';

import type { ITradeBlockFlushEvent } from './trade-bucket-accumulator';
import { TradeBucketAccumulator } from './trade-bucket-accumulator';

const FLOATS_PER_BUCKET = 4;
const MAX_BUCKETS_PER_BLOCK = 256;
const SOFT_CAP = 2000;
const MS_PER_SECOND = 1000;

const SECOND_T_MS = 1_700_000_000_000 as UnixTimeMs;
const SECOND_T_PLUS_1_MS = (SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs;
const SECOND_T_PLUS_2_MS = (SECOND_T_MS + 2 * MS_PER_SECOND) as UnixTimeMs;

interface ICreateAccumulatorOptions {
  readonly maxBucketsPerBlock?: number;
  readonly softCap?: number;
}

function createAccumulator(options: ICreateAccumulatorOptions = {}): {
  accumulator: TradeBucketAccumulator;
  flushes: ITradeBlockFlushEvent[];
} {
  const flushes: ITradeBlockFlushEvent[] = [];
  const accumulator = new TradeBucketAccumulator({
    maxBucketsPerBlock: options.maxBucketsPerBlock ?? MAX_BUCKETS_PER_BLOCK,
    floatsPerBucket: FLOATS_PER_BUCKET,
    activeBucketRawTradesSoftCap: options.softCap ?? SOFT_CAP,
    onFlush: event => flushes.push(event),
  });
  return { accumulator, flushes };
}

let nextTradeId = 1;

function makeTrade(params: {
  readonly eventTimeMs: UnixTimeMs;
  readonly price: number;
  readonly quantity: number;
  readonly isBuyerMaker: boolean;
}): ITrade {
  nextTradeId += 1;
  return {
    tradeId: nextTradeId as TradeId,
    eventTimeMs: params.eventTimeMs,
    price: params.price,
    quantity: params.quantity as Quantity,
    isBuyerMaker: params.isBuyerMaker,
  };
}

/**
 * Read the bucket aggregates packed into the block's `Float32Array` at
 * `bucketIdx`. Mirrors the renderer's decode path so the test verifies
 * the texture layout, not the accumulator's internal data structures.
 */
function readBucketAt(
  event: ITradeBlockFlushEvent,
  bucketIdx: number
): {
  readonly timeDeltaMs: number;
  readonly priceDelta: number;
  readonly volumeTotal: number;
  readonly buyFraction: number;
} {
  const offset = bucketIdx * FLOATS_PER_BUCKET;
  return {
    timeDeltaMs: event.data[offset + 0],
    priceDelta: event.data[offset + 1],
    volumeTotal: event.data[offset + 2],
    buyFraction: event.data[offset + 3],
  };
}

describe('TradeBucketAccumulator', () => {
  it('encodes a single taker-buy trade as buyFraction === 1.0 after second close', () => {
    const { accumulator, flushes } = createAccumulator();

    accumulator.addTrade(
      makeTrade({
        eventTimeMs: (SECOND_T_MS + 250) as UnixTimeMs,
        price: 100,
        quantity: 2,
        isBuyerMaker: false,
      })
    );
    expect(flushes).toHaveLength(0);

    // Second-rollover trade closes the prior bucket and triggers flush.
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_1_MS,
        price: 101,
        quantity: 1,
        isBuyerMaker: true,
      })
    );

    expect(flushes).toHaveLength(1);
    const event = flushes[0];
    expect(event.isNewBlock).toBe(false);
    expect(event.block.bucketCount).toBe(1);
    const bucket = readBucketAt(event, 0);
    expect(bucket.timeDeltaMs).toBe(0);
    expect(bucket.priceDelta).toBe(0);
    expect(bucket.volumeTotal).toBe(2);
    expect(bucket.buyFraction).toBe(1);
  });

  it('encodes a single taker-sell trade as buyFraction === 0.0 after second close', () => {
    const { accumulator, flushes } = createAccumulator();

    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 2,
        isBuyerMaker: true,
      })
    );
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_1_MS,
        price: 101,
        quantity: 1,
        isBuyerMaker: false,
      })
    );

    const bucket = readBucketAt(flushes[0], 0);
    expect(bucket.buyFraction).toBe(0);
  });

  it('computes vwap and buyFraction from a mixed trade set in a single second', () => {
    const { accumulator, flushes } = createAccumulator();

    // Three trades at the same second: two buys and one sell.
    const trades: ReadonlyArray<{
      readonly price: number;
      readonly quantity: number;
      readonly isBuyerMaker: boolean;
    }> = [
      { price: 100, quantity: 2, isBuyerMaker: false }, // buy notional 200
      { price: 102, quantity: 1, isBuyerMaker: true }, // sell notional 102
      { price: 101, quantity: 3, isBuyerMaker: false }, // buy notional 303
    ];
    for (const trade of trades) {
      accumulator.addTrade(
        makeTrade({
          eventTimeMs: SECOND_T_MS as UnixTimeMs,
          price: trade.price,
          quantity: trade.quantity,
          isBuyerMaker: trade.isBuyerMaker,
        })
      );
    }
    // Close the bucket with a trade in the next second.
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_1_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );

    expect(flushes).toHaveLength(1);
    const bucket = readBucketAt(flushes[0], 0);
    const totalNotional = 200 + 102 + 303;
    const totalVolume = 2 + 1 + 3;
    expect(bucket.volumeTotal).toBe(totalVolume);
    // priceDelta is `vwap - basePrice`; basePrice is the first trade's price (100).
    const expectedVwap = totalNotional / totalVolume;
    expect(bucket.priceDelta).toBeCloseTo(expectedVwap - 100, 6);
    expect(bucket.buyFraction).toBeCloseTo((200 + 303) / totalNotional, 6);
  });

  it('rolling into a new second flushes the previous bucket and opens a fresh active bucket', () => {
    const { accumulator, flushes } = createAccumulator();

    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_1_MS,
        price: 101,
        quantity: 1,
        isBuyerMaker: false,
      })
    );

    expect(flushes).toHaveLength(1);
    expect(flushes[0].isNewBlock).toBe(false);
    expect(flushes[0].block.bucketCount).toBe(1);

    // The fresh active bucket isn't visible until it closes; close it
    // by pushing a trade in yet another second.
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_2_MS,
        price: 102,
        quantity: 1,
        isBuyerMaker: false,
      })
    );
    expect(flushes).toHaveLength(2);
    expect(flushes[1].block.bucketCount).toBe(2);
    const second = readBucketAt(flushes[1], 1);
    expect(second.timeDeltaMs).toBe(MS_PER_SECOND);
  });

  it('skips zero-trade seconds (no empty bucket emitted)', () => {
    const { accumulator, flushes } = createAccumulator();

    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );
    // Skip second T+1 entirely; jump straight to T+2.
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_2_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );

    expect(flushes).toHaveLength(1);
    const event = flushes[0];
    expect(event.block.bucketCount).toBe(1);
    expect(event.block.lastBucketStartMs).toBe(SECOND_T_MS);

    // Closing the active bucket (at T+2) confirms the next flush jumps
    // by 2 seconds, not 1 — the empty T+1 bucket was never opened.
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: (SECOND_T_PLUS_2_MS + MS_PER_SECOND) as UnixTimeMs,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );
    expect(flushes).toHaveLength(2);
    const second = flushes[1];
    expect(second.block.bucketCount).toBe(2);
    expect(second.block.lastBucketStartMs).toBe(SECOND_T_PLUS_2_MS);
    const bucket1 = readBucketAt(second, 1);
    expect(bucket1.timeDeltaMs).toBe(2 * MS_PER_SECOND);
  });

  it('rotates to a fresh block once the per-block bucket cap is reached', () => {
    const blocksToTest = 4;
    const { accumulator, flushes } = createAccumulator({ maxBucketsPerBlock: blocksToTest });

    // Push trades for `blocksToTest + 1` distinct seconds so the
    // accumulator closes `blocksToTest` buckets (filling the block) and
    // then has to open a new one.
    for (let secondIndex = 0; secondIndex <= blocksToTest; secondIndex++) {
      accumulator.addTrade(
        makeTrade({
          eventTimeMs: (SECOND_T_MS + secondIndex * MS_PER_SECOND) as UnixTimeMs,
          price: 100 + secondIndex,
          quantity: 1,
          isBuyerMaker: false,
        })
      );
    }

    // Three flushes for buckets 0..blocksToTest-2 (`isNewBlock=false`),
    // then a "rotation pair": completed-old block + new block.
    expect(flushes).toHaveLength(blocksToTest + 1);

    const completedBlockEvent = flushes[blocksToTest - 1];
    const newBlockEvent = flushes[blocksToTest];
    expect(completedBlockEvent.isNewBlock).toBe(false);
    expect(completedBlockEvent.block.bucketCount).toBe(blocksToTest);
    expect(newBlockEvent.isNewBlock).toBe(true);
    expect(newBlockEvent.block.blockId).not.toBe(completedBlockEvent.block.blockId);
    expect(newBlockEvent.block.bucketCount).toBe(0);
  });

  it('truncates raw trades past the soft cap but keeps aggregates exact', () => {
    const cap = 5;
    const totalTrades = cap * 2 + 1; // 11 trades > cap = 5
    const { accumulator, flushes } = createAccumulator({ softCap: cap });

    for (let tradeIndex = 0; tradeIndex < totalTrades; tradeIndex++) {
      accumulator.addTrade(
        makeTrade({
          eventTimeMs: (SECOND_T_MS + tradeIndex) as UnixTimeMs,
          price: 100,
          quantity: 1,
          isBuyerMaker: false,
        })
      );
    }
    // Close the bucket so we can verify the flushed aggregates.
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_1_MS,
        price: 100,
        quantity: 0.5,
        isBuyerMaker: false,
      })
    );

    expect(flushes).toHaveLength(1);
    const bucket = readBucketAt(flushes[0], 0);
    expect(bucket.volumeTotal).toBe(totalTrades);

    // Raw trades attached to the flush should be capped at `softCap`.
    const rawTrades = flushes[0].rawTradesByBucket.get(SECOND_T_MS);
    expect(rawTrades?.length).toBe(cap);
  });

  it('dispose() drops the active bucket without emitting and ignores subsequent trades', () => {
    const { accumulator, flushes } = createAccumulator();

    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );
    expect(flushes).toHaveLength(0);

    accumulator.dispose();
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_1_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );

    expect(flushes).toHaveLength(0);
    expect(accumulator.getActiveBlockData()).toBeUndefined();
    expect(accumulator.getActiveBucketSnapshot()).toBeUndefined();
  });

  it('texture layout invariant: firstBucketStartMs + timeDeltaMs equals bucketStartMs', () => {
    const { accumulator, flushes } = createAccumulator();

    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );
    // Skip a second to make `timeDeltaMs` non-trivial (2 s).
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: SECOND_T_PLUS_2_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );
    accumulator.addTrade(
      makeTrade({
        eventTimeMs: (SECOND_T_PLUS_2_MS + MS_PER_SECOND) as UnixTimeMs,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      })
    );

    const flush = flushes[flushes.length - 1];
    const bucket0 = readBucketAt(flush, 0);
    const bucket1 = readBucketAt(flush, 1);
    expect(flush.block.firstBucketStartMs + bucket0.timeDeltaMs).toBe(SECOND_T_MS);
    expect(flush.block.firstBucketStartMs + bucket1.timeDeltaMs).toBe(SECOND_T_PLUS_2_MS);
  });
});
