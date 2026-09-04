import { isNil } from 'lodash-es';

import { encodeCandle, FLOATS_PER_CANDLE } from '../domain/candle-encoding';
import type { ICandle, ICandleBlockMeta } from '../domain/candle-types';
import type { ICandleFlushEvent } from '../domain/flush-events';

export interface ICandleBlockAccumulatorParams {
  readonly candlesPerBlock: number;
  readonly onFlush: (event: ICandleFlushEvent) => void;
}

interface IActiveBlock {
  meta: ICandleBlockMeta;
  readonly data: Float32Array;
}

/**
 * Packs the dense candle series into fixed-size blocks whose texels store
 * prices relative to the block's first open (`basePrice`). Every candle is
 * flushed as soon as it arrives so the chart's live edge never lags.
 */
export class CandleBlockAccumulator {
  private readonly candlesPerBlock: number;
  private readonly onFlush: (event: ICandleFlushEvent) => void;
  private activeBlock: IActiveBlock | undefined = undefined;

  constructor(params: ICandleBlockAccumulatorParams) {
    this.candlesPerBlock = params.candlesPerBlock;
    this.onFlush = params.onFlush;
  }

  addCandle(candle: ICandle): void {
    const current = this.activeBlock;
    const block =
      isNil(current) || current.meta.count >= this.candlesPerBlock
        ? this.startNewBlock(candle)
        : current;
    const isNewBlock = block !== current;
    this.activeBlock = block;

    encodeCandle(candle, block.meta, block.data, block.meta.count);
    block.meta = {
      ...block.meta,
      count: block.meta.count + 1,
      lastBucketStartMs: candle.bucketStartMs,
    };

    this.onFlush({ block: block.meta, data: block.data, isNewBlock, addedCandles: 1 });
  }

  dispose(): void {
    this.activeBlock = undefined;
  }

  private startNewBlock(candle: ICandle): IActiveBlock {
    return {
      meta: {
        blockId: candle.bucketStartMs,
        firstBucketStartMs: candle.bucketStartMs,
        lastBucketStartMs: candle.bucketStartMs,
        basePrice: candle.open,
        count: 0,
      },
      data: new Float32Array(this.candlesPerBlock * FLOATS_PER_CANDLE),
    };
  }
}
