import { ChartDataError } from '@frozik/charts/core/series/data-error';
import type { TBatch, TShape } from '@frozik/charts/core/series/shape';
import type {
  IFetchRequest,
  ISubscribeRequest,
  ITimeseriesSource,
} from '@frozik/charts/data/timeseries/source';
import { isNil } from 'lodash-es';

import type { TNoise } from '../domain/noise';

/** A series with no live edge starts its subscription here: everything before is history. */
const ENDLESS_SINCE = 7_258_118_400_000_000_000n;
const NANOS_PER_MILLISECOND = 1_000_000;
const MIN_TICK_MS = 100;
const MAX_TICK_MS = 1000;
/** How many moments inside a candle are looked at to find its extremes. */
const CANDLE_SAMPLES = 8;

export interface INoiseSourceOptions {
  readonly noise: TNoise;
  /** How long an answer takes, milliseconds: stands for the network. */
  readonly delayMs: () => number;
  /** What a request is rejected with, when the source is to fail. */
  readonly failure?: () => ChartDataError | undefined;
  /** The present moment, nanoseconds: nothing exists after it and new elements keep arriving. Without it the series is endless and still. */
  readonly now?: () => bigint;
}

function floorTo(time: bigint, step: bigint): bigint {
  const remainder = time % step;
  return time - (remainder < 0n ? remainder + step : remainder);
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = (): void => {
      clearTimeout(timer);
      reject(new ChartDataError('CANCELLED', 'the request was aborted'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

interface ISpan {
  readonly first: bigint | undefined;
  readonly last: bigint | undefined;
}

/** The span cut to the soft limit from the end the direction names; `reach` is the length the limit allows. */
function limited(
  { direction }: IFetchRequest,
  { first, last }: ISpan,
  reach: bigint
): { readonly start: bigint; readonly end: bigint } {
  if (isNil(first)) {
    if (isNil(last)) {
      throw new ChartDataError('INVALID_ARGUMENT', 'a request names at least one bound');
    }
    return { start: last - reach, end: last };
  }
  if (isNil(last)) {
    return { start: first, end: first + reach };
  }
  if (last - first <= reach) {
    return { start: first, end: last };
  }
  return direction === 'forward'
    ? { start: first, end: first + reach }
    : { start: last - reach, end: last };
}

/**
 * A time series source over noise: one element at every multiple of the scale,
 * a point the value at that moment and a candle the path over its interval.
 * It keeps the contract of a real server — bounds, direction, soft limit,
 * a subscription that starts where history ends — and answers with a delay.
 */
export function noiseSource({
  noise,
  delayMs,
  failure,
  now,
}: INoiseSourceOptions): ITimeseriesSource {
  /** The time of the last element that exists: a candle exists once its interval has closed. */
  const lastExisting = (shape: TShape, scale: bigint): bigint | undefined => {
    if (isNil(now)) {
      return undefined;
    }
    return floorTo(shape === 'candle' ? now() - scale : now(), scale);
  };

  const candleAt = (start: bigint, end: bigint) => {
    const open = noise(start);
    const close = noise(end);
    let min = Math.min(open, close);
    let max = Math.max(open, close);
    for (let sample = 1; sample < CANDLE_SAMPLES; sample += 1) {
      const value = noise(start + ((end - start) * BigInt(sample)) / BigInt(CANDLE_SAMPLES));
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    return { x: start, open, min, max, close };
  };

  const batchOf = (shape: TShape, scale: bigint, first: bigint, count: number): TBatch => {
    const x = new BigInt64Array(count);
    for (let index = 0; index < count; index += 1) {
      x[index] = first + BigInt(index) * scale;
    }
    if (shape === 'point') {
      return { shape, points: { x, value: Float64Array.from(x, time => noise(time)) } };
    }
    const open = new Float64Array(count);
    const min = new Float64Array(count);
    const max = new Float64Array(count);
    const close = new Float64Array(count);
    x.forEach((time, index) => {
      const candle = candleAt(time, time + scale);
      open[index] = candle.open;
      min[index] = candle.min;
      max[index] = candle.max;
      close[index] = candle.close;
    });
    return { shape, candles: { x, open, min, max, close } };
  };

  /** The first and the last element time the request covers, before the limit. */
  const spanOf = (request: IFetchRequest): ISpan => {
    const { from, to, includeFrom, includeTo, scale, shape } = request;
    let first: bigint | undefined;
    if (!isNil(from)) {
      const aligned = floorTo(from, scale);
      first =
        aligned === from && includeFrom
          ? aligned
          : aligned === from
            ? from + scale
            : aligned + scale;
    }
    let last: bigint | undefined;
    if (!isNil(to)) {
      const aligned = floorTo(to, scale);
      last = aligned === to && !includeTo ? to - scale : aligned;
    }
    const existing = lastExisting(shape, scale);
    if (!isNil(existing) && (isNil(last) || last > existing)) {
      last = existing;
    }
    return { first, last };
  };

  return {
    async fetch(request): Promise<TBatch> {
      await wait(delayMs(), request.signal);
      const rejection = failure?.();
      if (!isNil(rejection)) {
        throw rejection;
      }
      const { scale, shape, softLimit } = request;
      const { start, end } = limited(request, spanOf(request), BigInt(softLimit - 1) * scale);
      return batchOf(shape, scale, start, end < start ? 0 : Number((end - start) / scale) + 1);
    },

    subscribe(request: ISubscribeRequest): VoidFunction {
      const { scale, shape } = request;
      const liveEdge = (): bigint => lastExisting(shape, scale) ?? ENDLESS_SINCE;
      /** The time of the last element delivered; none while the connection is down. */
      let sent: bigint | undefined;
      let isDownReported = false;

      const deliver = (): void => {
        if (isNil(sent) || isNil(now)) {
          return;
        }
        const existing = liveEdge();
        if (existing > sent) {
          request.onBatch(batchOf(shape, scale, sent + scale, Number((existing - sent) / scale)));
          sent = existing;
        }
        if (shape === 'candle') {
          request.onPending?.(candleAt(existing + scale, now()));
        }
      };

      /** While the source is failing nothing is delivered and the error is told once; back up, the subscription starts anew, as after a reconnect. */
      const tick = (): void => {
        const rejection = failure?.();
        if (!isNil(rejection)) {
          sent = undefined;
          if (!isDownReported) {
            isDownReported = true;
            request.onError(rejection);
          }
          return;
        }
        if (isNil(sent)) {
          isDownReported = false;
          sent = liveEdge();
          request.onStart(sent);
        }
        deliver();
      };

      const start = setTimeout(tick, delayMs());
      const period = Math.min(
        MAX_TICK_MS,
        Math.max(MIN_TICK_MS, Number(scale) / NANOS_PER_MILLISECOND)
      );
      const timer = setInterval(tick, period);
      return () => {
        clearTimeout(start);
        clearInterval(timer);
      };
    },
  };
}
