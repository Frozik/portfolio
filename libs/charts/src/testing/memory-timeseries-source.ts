import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import { ChartDataError } from '../core/series/data-error';
import type { ICandle, IPoint, TBatch, TShape } from '../core/series/shape';
import type {
  IFetchRequest,
  ISubscribeRequest,
  ITimeseriesSource,
} from '../data/timeseries/source';
import type { TTimeScale } from '../data/timeseries/time-scale';

export interface IMemorySourceOptions {
  /** Ascending by time; the same at every scale. */
  readonly points?: readonly IPoint[];
  readonly candles?: readonly ICandle[];
  /** The scales the source has; any, when not given. */
  readonly scales?: readonly TTimeScale[];
}

/** A time series source over arrays in memory that keeps the contract to the letter: the reference for tests and for writing one's own (§4.4). */
export interface IMemorySource extends ITimeseriesSource {
  /** Every request made, oldest first. */
  readonly requests: readonly IFetchRequest[];
  readonly subscriptions: readonly ISubscribeRequest[];
  /** The next requests are rejected with this error, until it is taken away. */
  failWith: ChartDataError | undefined;
  /** Starts every open subscription: only elements later than `since` will come through it. */
  start(since: bigint): void;
  /** New elements: remembered as history and sent to every started subscription of their shape. */
  push(batch: TBatch): void;
  pending(element: IPoint | ICandle | undefined): void;
  error(error: unknown): void;
}

type TElement = IPoint | ICandle;

function within(element: TElement, request: IFetchRequest): boolean {
  const { from, to, includeFrom, includeTo } = request;
  const afterFrom = isNil(from) || (includeFrom ? element.x >= from : element.x > from);
  const beforeTo = isNil(to) || (includeTo ? element.x <= to : element.x < to);
  return afterFrom && beforeTo;
}

/** At least `softLimit` elements from the end the direction names, and all that share the time of the last one taken. */
function cut<TItem extends TElement>(
  elements: readonly TItem[],
  request: IFetchRequest
): readonly TItem[] {
  const { softLimit, direction } = request;
  if (elements.length <= softLimit) {
    return elements;
  }
  if (direction === 'forward') {
    let end = softLimit;
    while (end < elements.length && elements[end].x === elements[softLimit - 1].x) {
      end += 1;
    }
    return elements.slice(0, end);
  }
  let start = elements.length - softLimit;
  while (start > 0 && elements[start - 1].x === elements[elements.length - softLimit].x) {
    start -= 1;
  }
  return elements.slice(start);
}

function objectsOf<TItem>(elements: readonly TItem[] | object): readonly TItem[] {
  assert(Array.isArray(elements), 'the memory source takes elements as objects');
  return elements;
}

export function memorySource(options: IMemorySourceOptions = {}): IMemorySource {
  const points = [...(options.points ?? [])];
  const candles = [...(options.candles ?? [])];
  const requests: IFetchRequest[] = [];
  const subscriptions = new Set<ISubscribeRequest>();
  const started = new Set<ISubscribeRequest>();

  const checkExists = (shape: TShape, scale: TTimeScale): void => {
    if (!isNil(options.scales) && !options.scales.includes(scale)) {
      throw new ChartDataError('NOT_FOUND', `no ${shape}s at the scale of ${scale} ns`);
    }
    if (shape === 'candle' && isNil(options.candles)) {
      throw new ChartDataError('UNIMPLEMENTED', 'the source has no candles');
    }
  };

  const source: IMemorySource = {
    requests,
    get subscriptions(): readonly ISubscribeRequest[] {
      return [...subscriptions];
    },
    failWith: undefined,

    async fetch(request): Promise<TBatch> {
      requests.push(request);
      assert(!isNil(request.from) || !isNil(request.to), 'a request names at least one bound');
      if (!isNil(source.failWith)) {
        throw source.failWith;
      }
      checkExists(request.shape, request.scale);
      await Promise.resolve();
      if (request.signal.aborted) {
        throw new ChartDataError('CANCELLED', 'the request was aborted');
      }
      return request.shape === 'point'
        ? {
            shape: 'point',
            points: cut(
              points.filter(point => within(point, request)),
              request
            ),
          }
        : {
            shape: 'candle',
            candles: cut(
              candles.filter(candle => within(candle, request)),
              request
            ),
          };
    },

    subscribe(request): VoidFunction {
      subscriptions.add(request);
      return () => {
        subscriptions.delete(request);
        started.delete(request);
      };
    },

    start(since): void {
      for (const subscription of subscriptions) {
        started.add(subscription);
        subscription.onStart(since);
      }
    },

    push(batch): void {
      if (batch.shape === 'point') {
        points.push(...objectsOf(batch.points));
      } else {
        candles.push(...objectsOf(batch.candles));
      }
      for (const subscription of started) {
        if (subscription.shape === batch.shape) {
          subscription.onBatch(batch);
        }
      }
    },

    pending(element): void {
      for (const subscription of started) {
        subscription.onPending?.(element);
      }
    },

    error(error): void {
      for (const subscription of [...subscriptions]) {
        subscription.onError(error);
      }
    },
  };
  return source;
}
