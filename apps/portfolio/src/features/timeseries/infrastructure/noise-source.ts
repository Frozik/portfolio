import { ChartDataError } from '@frozik/charts/core/series/data-error';
import type { TBatch, TShape } from '@frozik/charts/core/series/shape';
import type {
  IFetchRequest,
  ISubscribeRequest,
  ITimeseriesSource,
} from '@frozik/charts/data/timeseries/source';
import { NANOS_PER_MILLISECOND } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';

import type { TNoise } from '../domain/noise';
import type { IBarGrid } from './bar-grid';
import { uniformGrid } from './bar-grid';

/** A series with no live edge starts its subscription here: everything before is history. */
const ENDLESS_SINCE = 7_258_118_400_000_000_000n;
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
  /** Where the elements of a scale stand; at every multiple of it from the epoch by default. */
  readonly gridOf?: (scale: bigint) => IBarGrid;
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
  gridOf = uniformGrid,
}: INoiseSourceOptions): ITimeseriesSource {
  /** The time of the last element that exists: a candle exists once its interval has closed. */
  const lastExisting = (shape: TShape, grid: IBarGrid): bigint | undefined => {
    if (isNil(now)) {
      return undefined;
    }
    const present = now();
    let last = grid.floor(present);
    while (shape === 'candle' && grid.end(last) > present) {
      last = grid.previous(last);
    }
    return last;
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

  const batchOf = (shape: TShape, grid: IBarGrid, times: readonly bigint[]): TBatch => {
    const x = BigInt64Array.from(times);
    if (shape === 'point') {
      return { shape, points: { x, value: Float64Array.from(x, time => noise(time)) } };
    }
    const { length } = x;
    const open = new Float64Array(length);
    const min = new Float64Array(length);
    const max = new Float64Array(length);
    const close = new Float64Array(length);
    x.forEach((time, index) => {
      const candle = candleAt(time, grid.end(time));
      open[index] = candle.open;
      min[index] = candle.min;
      max[index] = candle.max;
      close[index] = candle.close;
    });
    return { shape, candles: { x, open, min, max, close } };
  };

  /** The element times the request covers, ascending: up to the limit from the end the direction names. */
  const timesOf = (request: IFetchRequest, grid: IBarGrid): readonly bigint[] => {
    const { from, to, includeFrom, includeTo, shape, direction, softLimit } = request;
    const first = isNil(from)
      ? undefined
      : includeFrom && grid.floor(from) === from
        ? from
        : grid.next(grid.floor(from));
    let last = isNil(to)
      ? undefined
      : includeTo || grid.floor(to) !== to
        ? grid.floor(to)
        : grid.previous(to);
    const existing = lastExisting(shape, grid);
    if (!isNil(existing) && (isNil(last) || last > existing)) {
      last = existing;
    }
    const times: bigint[] = [];
    if (direction === 'forward' && !isNil(first)) {
      for (
        let time = first;
        times.length < softLimit && (isNil(last) || time <= last);
        time = grid.next(time)
      ) {
        times.push(time);
      }
      return times;
    }
    if (isNil(last)) {
      throw new ChartDataError('INVALID_ARGUMENT', 'a request names at least one bound');
    }
    for (
      let time = last;
      times.length < softLimit && (isNil(first) || time >= first);
      time = grid.previous(time)
    ) {
      times.push(time);
    }
    return times.reverse();
  };

  return {
    async fetch(request): Promise<TBatch> {
      await wait(delayMs(), request.signal);
      const rejection = failure?.();
      if (!isNil(rejection)) {
        throw rejection;
      }
      const grid = gridOf(request.scale);
      return batchOf(request.shape, grid, timesOf(request, grid));
    },

    subscribe(request: ISubscribeRequest): VoidFunction {
      const { scale, shape } = request;
      const grid = gridOf(scale);
      const liveEdge = (): bigint => lastExisting(shape, grid) ?? ENDLESS_SINCE;
      /** The time of the last element delivered; none while the connection is down. */
      let sent: bigint | undefined;
      let isDownReported = false;

      const deliver = (): void => {
        if (isNil(sent) || isNil(now)) {
          return;
        }
        const existing = liveEdge();
        if (existing > sent) {
          const times: bigint[] = [];
          for (let time = grid.next(sent); time <= existing; time = grid.next(time)) {
            times.push(time);
          }
          request.onBatch(batchOf(shape, grid, times));
          sent = existing;
        }
        if (shape === 'candle') {
          const forming = grid.next(existing);
          request.onPending?.(forming <= now() ? candleAt(forming, now()) : undefined);
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
