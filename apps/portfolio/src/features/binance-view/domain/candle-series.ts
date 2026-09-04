import { isNil } from 'lodash-es';

import type { ICandle, IOhlcBucket } from './candle-types';
import { MOVING_AVERAGE_LONG_PERIOD, MOVING_AVERAGE_SHORT_PERIOD } from './constants';
import type { UnixTimeMs } from './types';

const MS_PER_SECOND = 1000;

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Turns closed trade buckets into a dense one-second candle series. A
 * second without trades becomes a flat candle at the previous close so the
 * series has no holes and the moving averages stay defined; the averages
 * are simple means of the last N closes, over a partial window until N
 * candles exist.
 */
export class CandleSeriesBuilder {
  private recentCloses: number[] = [];
  private lastBucketStartMs: UnixTimeMs | undefined = undefined;

  /** Candles produced by this bucket: gap-filling flats first, then the bucket itself. */
  append(bucket: IOhlcBucket): readonly ICandle[] {
    const candles: ICandle[] = [];
    const previousClose = this.recentCloses.at(-1);
    if (!isNil(this.lastBucketStartMs) && !isNil(previousClose)) {
      for (
        let gapStartMs = this.lastBucketStartMs + MS_PER_SECOND;
        gapStartMs < bucket.bucketStartMs;
        gapStartMs += MS_PER_SECOND
      ) {
        candles.push(this.close(flatBucket(gapStartMs as UnixTimeMs, previousClose)));
      }
    }
    candles.push(this.close(bucket));
    return candles;
  }

  private close(bucket: IOhlcBucket): ICandle {
    this.recentCloses = [...this.recentCloses, bucket.close].slice(-MOVING_AVERAGE_LONG_PERIOD);
    this.lastBucketStartMs = bucket.bucketStartMs;
    return {
      ...bucket,
      movingAverage5: average(this.recentCloses.slice(-MOVING_AVERAGE_SHORT_PERIOD)),
      movingAverage10: average(this.recentCloses),
    };
  }
}

function flatBucket(bucketStartMs: UnixTimeMs, price: number): IOhlcBucket {
  return { bucketStartMs, open: price, high: price, low: price, close: price };
}
