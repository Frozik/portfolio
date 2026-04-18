import type { Milliseconds } from '@frozik/utils';
import { packColor } from '@frozik/utils';
import {
  MID_PRICE_COLOR_DOWN,
  MID_PRICE_COLOR_FLAT,
  MID_PRICE_COLOR_UP,
} from '../domain/constants';
import { floorToBlockStart } from '../domain/math';
import { classifyDirection, computePriceChangeRatio } from '../domain/mid-price-change';
import type {
  IMidPriceBlockMeta,
  IMidPriceSample,
  MidPriceDirection,
} from '../domain/mid-price-types';

/**
 * Floats per sample: `[timeDeltaMs, priceDelta, priceChangeRatio, packedColor]`.
 *
 * `priceChangeRatio = (sample.price - prev.price) / sample.price` —
 * dimensionless, fed into the shader's width formula.
 */
const FLOATS_PER_SAMPLE = 4;

const COLOR_UP_PACKED = packColor(...MID_PRICE_COLOR_UP);
const COLOR_DOWN_PACKED = packColor(...MID_PRICE_COLOR_DOWN);
const COLOR_FLAT_PACKED = packColor(...MID_PRICE_COLOR_FLAT);

/**
 * Event emitted by the accumulator whenever new samples are ready to
 * be written to the GPU texture and persisted. `data` is the
 * accumulator's authoritative `Float32Array` — consumers must snapshot
 * / copy the slice they need before the next flush, never retain the
 * reference.
 */
export interface IMidPriceFlushEvent {
  readonly block: IMidPriceBlockMeta;
  readonly data: Float32Array;
  readonly isNewBlock: boolean;
  readonly addedSamples: number;
}

export interface IMidPriceBlockAccumulatorParams {
  readonly samplesPerBlock: number;
  readonly updateSpeedMs: Milliseconds;
  readonly flushEverySamples: number;
  readonly onFlush: (event: IMidPriceFlushEvent) => void;
}

/**
 * Accumulates mid-price samples (computed locally from each orderbook
 * snapshot as `(bestBid + bestAsk) / 2`) into fixed-size blocks and
 * emits flush events whenever `flushEverySamples` samples have been
 * written (or the current block becomes full).
 *
 * One block = `samplesPerBlock` contiguous texels aligned on
 * `floorToBlockStart(firstSample.eventTimeMs, samplesPerBlock,
 * updateSpeedMs)`. Each texel encodes:
 *
 *   `[timeDeltaMs, priceDelta, priceChangeRatio, packedColor]`
 *
 * where `timeDeltaMs` / `priceDelta` are relative to the block's
 * `firstTimestampMs` / `basePrice` (kept inside `f32` range for any
 * realistic crypto price), `priceChangeRatio` is the signed relative
 * change `(current - previous) / current` used by the shader's width
 * formula, and `packedColor` is the `packColor()` of the discrete
 * direction (`up` / `down` / `flat`) of the same segment.
 *
 * Cross-block continuity: the slope / colour of the first sample in a
 * new block is computed against the *last* sample of the previous
 * block (carried via {@link lastSample}), so segments stitch visually
 * across block boundaries without the line briefly going flat.
 */
export class MidPriceBlockAccumulator {
  private readonly samplesPerBlock: number;
  private readonly updateSpeedMs: Milliseconds;
  private readonly flushEverySamples: number;
  private readonly onFlush: (event: IMidPriceFlushEvent) => void;

  private meta: IMidPriceBlockMeta | null = null;
  private activeData: Float32Array | null = null;
  private lastSample: IMidPriceSample | null = null;
  private pendingSamples = 0;
  private disposed = false;

  constructor(params: IMidPriceBlockAccumulatorParams) {
    this.samplesPerBlock = params.samplesPerBlock;
    this.updateSpeedMs = params.updateSpeedMs;
    this.flushEverySamples = Math.max(1, params.flushEverySamples);
    this.onFlush = params.onFlush;
  }

  addSample(sample: IMidPriceSample): void {
    if (this.disposed) {
      return;
    }

    const isNewBlock = this.meta === null || this.meta.count >= this.samplesPerBlock;
    if (isNewBlock) {
      this.startNewBlock(sample);
    }

    const meta = this.meta;
    const data = this.activeData;
    if (meta === null || data === null) {
      return;
    }

    const priceChangeRatio =
      this.lastSample === null ? 0 : computePriceChangeRatio(this.lastSample.price, sample.price);
    const direction = classifyDirection(priceChangeRatio);

    const offset = meta.count * FLOATS_PER_SAMPLE;
    data[offset + 0] = sample.eventTimeMs - meta.firstTimestampMs;
    data[offset + 1] = sample.price - meta.basePrice;
    data[offset + 2] = priceChangeRatio;
    data[offset + 3] = packedColorFor(direction);

    meta.count += 1;
    meta.lastTimestampMs = sample.eventTimeMs;
    this.lastSample = sample;
    this.pendingSamples += 1;

    const shouldFlushCadence = this.pendingSamples >= this.flushEverySamples;
    const shouldFlushBlockFull = meta.count >= this.samplesPerBlock;
    if (shouldFlushCadence || shouldFlushBlockFull) {
      this.emitFlush(isNewBlock);
    }
  }

  /** Clears state and prevents further emissions. Safe to call multiple times. */
  dispose(): void {
    this.disposed = true;
    this.meta = null;
    this.activeData = null;
    this.lastSample = null;
    this.pendingSamples = 0;
  }

  private startNewBlock(sample: IMidPriceSample): void {
    const firstTimestampMs = floorToBlockStart(
      sample.eventTimeMs,
      this.samplesPerBlock,
      this.updateSpeedMs
    );
    this.meta = {
      blockId: firstTimestampMs,
      firstTimestampMs,
      basePrice: sample.price,
      lastTimestampMs: sample.eventTimeMs,
      count: 0,
      textureRowIndex: undefined,
    };
    this.activeData = new Float32Array(this.samplesPerBlock * FLOATS_PER_SAMPLE);
    this.pendingSamples = 0;
  }

  private emitFlush(isNewBlock: boolean): void {
    if (this.meta === null || this.activeData === null || this.pendingSamples === 0) {
      return;
    }
    const event: IMidPriceFlushEvent = {
      block: this.meta,
      data: this.activeData,
      isNewBlock,
      addedSamples: this.pendingSamples,
    };
    this.pendingSamples = 0;
    this.onFlush(event);
  }
}

function packedColorFor(direction: MidPriceDirection): number {
  switch (direction) {
    case 'up':
      return COLOR_UP_PACKED;
    case 'down':
      return COLOR_DOWN_PACKED;
    case 'flat':
      return COLOR_FLAT_PACKED;
  }
}

export { FLOATS_PER_SAMPLE as MID_PRICE_FLOATS_PER_SAMPLE };
