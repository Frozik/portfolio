import type { Milliseconds } from '@frozik/utils';
import { packColor } from '@frozik/utils';
import {
  MID_PRICE_COLOR_DOWN,
  MID_PRICE_COLOR_FLAT,
  MID_PRICE_COLOR_UP,
  MID_PRICE_SAMPLES_PER_BLOCK,
} from '../domain/constants';
import type { IMidPriceSample } from '../domain/mid-price-types';
import type { UnixTimeMs } from '../domain/types';

import type { IMidPriceFlushEvent } from './mid-price-block-accumulator';
import {
  MID_PRICE_FLOATS_PER_SAMPLE,
  MidPriceBlockAccumulator,
} from './mid-price-block-accumulator';

const UPDATE_SPEED_MS = 1000 as Milliseconds;

function createAccumulator(samplesPerBlock = MID_PRICE_SAMPLES_PER_BLOCK) {
  const flushes: IMidPriceFlushEvent[] = [];
  const accumulator = new MidPriceBlockAccumulator({
    samplesPerBlock,
    updateSpeedMs: UPDATE_SPEED_MS,
    flushEverySamples: 1,
    onFlush: event => flushes.push(event),
  });
  return { accumulator, flushes };
}

function sample(eventTimeMs: number, price: number): IMidPriceSample {
  return {
    eventTimeMs: eventTimeMs as UnixTimeMs,
    price,
  };
}

describe('MidPriceBlockAccumulator', () => {
  it('aligns the block start to floorToBlockStart(firstSample)', () => {
    const { accumulator, flushes } = createAccumulator();
    accumulator.addSample(sample(1_700_000_123_456, 50_000));
    expect(flushes).toHaveLength(1);
    const blockDurationMs = MID_PRICE_SAMPLES_PER_BLOCK * UPDATE_SPEED_MS;
    expect(flushes[0].block.firstTimestampMs % blockDurationMs).toBe(0);
    expect(flushes[0].block.firstTimestampMs).toBeLessThanOrEqual(1_700_000_123_456);
  });

  it('packs the first sample as a flat segment with zero slope', () => {
    const { accumulator, flushes } = createAccumulator();
    accumulator.addSample(sample(1_000, 100));
    const { data } = flushes[0];
    expect(data[0]).toBe(1_000 - flushes[0].block.firstTimestampMs);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(packColor(...MID_PRICE_COLOR_FLAT));
  });

  it('encodes rising prices with the up colour and positive ratio (Δ / current)', () => {
    const { accumulator, flushes } = createAccumulator();
    accumulator.addSample(sample(1_000, 100));
    accumulator.addSample(sample(2_000, 110));
    const { data } = flushes[1];
    const offset = MID_PRICE_FLOATS_PER_SAMPLE;
    expect(data[offset + 1]).toBeCloseTo(10, 6);
    expect(data[offset + 2]).toBeCloseTo(10 / 110, 6);
    expect(data[offset + 3]).toBe(packColor(...MID_PRICE_COLOR_UP));
  });

  it('encodes falling prices with the down colour and negative ratio', () => {
    const { accumulator, flushes } = createAccumulator();
    accumulator.addSample(sample(1_000, 110));
    accumulator.addSample(sample(2_000, 100));
    const { data } = flushes[1];
    const offset = MID_PRICE_FLOATS_PER_SAMPLE;
    expect(data[offset + 2]).toBeCloseTo(-10 / 100, 6);
    expect(data[offset + 3]).toBe(packColor(...MID_PRICE_COLOR_DOWN));
  });

  it('rolls over to a fresh block once the current block fills', () => {
    const samplesPerBlock = 4;
    const { accumulator, flushes } = createAccumulator(samplesPerBlock);

    for (let step = 0; step < samplesPerBlock + 1; step++) {
      accumulator.addSample(sample(1_000 + step * 1000, 100 + step));
    }

    expect(flushes).toHaveLength(samplesPerBlock + 1);
    expect(flushes[samplesPerBlock - 1].block.blockId).toBe(flushes[0].block.blockId);
    const rolloverEvent = flushes[samplesPerBlock];
    expect(rolloverEvent.isNewBlock).toBe(true);
    expect(rolloverEvent.block.blockId).not.toBe(flushes[0].block.blockId);
    expect(rolloverEvent.block.count).toBe(1);
  });

  it('carries the last sample across a block rollover so the next segment has real ratio', () => {
    const samplesPerBlock = 2;
    const { accumulator, flushes } = createAccumulator(samplesPerBlock);

    accumulator.addSample(sample(0, 100));
    accumulator.addSample(sample(1000, 101));
    accumulator.addSample(sample(2000, 103));

    const rolloverEvent = flushes[2];
    expect(rolloverEvent.isNewBlock).toBe(true);
    // First texel of the new block reflects the (101 → 103) segment:
    // ratio = (103 - 101) / 103.
    expect(rolloverEvent.data[2]).toBeCloseTo(2 / 103, 6);
    expect(rolloverEvent.data[3]).toBe(packColor(...MID_PRICE_COLOR_UP));
  });

  it('uses the first sample of a new block as its basePrice', () => {
    const samplesPerBlock = 2;
    const { accumulator, flushes } = createAccumulator(samplesPerBlock);

    accumulator.addSample(sample(0, 100));
    accumulator.addSample(sample(1000, 110));
    accumulator.addSample(sample(2000, 130));

    expect(flushes[0].block.basePrice).toBe(100);
    expect(flushes[2].block.basePrice).toBe(130);
    // priceDelta for the new block's first sample is zero (basePrice aliases first price).
    expect(flushes[2].data[1]).toBe(0);
  });

  it('dispose() stops further flushes', () => {
    const { accumulator, flushes } = createAccumulator();
    accumulator.addSample(sample(0, 100));
    accumulator.dispose();
    accumulator.addSample(sample(1000, 101));
    expect(flushes).toHaveLength(1);
  });
});
