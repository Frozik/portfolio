import type { Milliseconds } from '@frozik/utils/date/types';
import type { Observable } from 'rxjs';
import { concat, defer, of, throwError } from 'rxjs';
import { map, retry } from 'rxjs/operators';

import { aggregateSnapshotByBin } from '../domain/aggregate-snapshot';
import type { InstrumentSymbol } from '../domain/instruments';
import type { IOrderbookSnapshot, IQuantizedSnapshot } from '../domain/types';

import { awaitReconnectReady } from './await-reconnect-ready';
import type { IRawOrderBookUpdate } from './binance-raw.types';
import type { IOrderBookSequenceGapInfo } from './orderbook-errors';
import { OrderBookSequenceGapError, OrderBookStreamClosedError } from './orderbook-errors';
import type { IOrderbookSnapshotData } from './orderbook-mapper';
import { buildOrderBookState$ } from './orderbook-pipeline';
import { quantizeBySecond } from './quantize-by-second';
import { webSocketWithOpenTimeout } from './ws-open-timeout';

const DEFAULT_RECONNECT_DELAY_MS: Milliseconds = 1000 as Milliseconds;
const DEFAULT_MAX_SEQUENCE_GAP_RETRIES = 5;

function createOrderBookStream$(params: {
  streamHost: string;
  instrument: InstrumentSymbol;
  updateSpeedMs: Milliseconds;
  depth: number;
  restUrl: string;
  onSequenceGap?: (info: IOrderBookSequenceGapInfo) => void;
  maxSequenceGapRetries?: number;
}): Observable<IOrderbookSnapshotData> {
  const {
    streamHost,
    instrument,
    updateSpeedMs,
    depth,
    restUrl,
    onSequenceGap,
    maxSequenceGapRetries,
  } = params;

  const wsUrl = `${streamHost}/ws/${instrument.toLowerCase()}@depth@${updateSpeedMs}ms`;
  const rawUpdates$ = webSocketWithOpenTimeout<IRawOrderBookUpdate>({ url: wsUrl });

  return defer(() => buildOrderBookState$({ rawUpdates$, restUrl, instrument, depth })).pipe(
    retry({
      count: maxSequenceGapRetries ?? DEFAULT_MAX_SEQUENCE_GAP_RETRIES,
      delay: error => {
        if (error instanceof OrderBookSequenceGapError) {
          onSequenceGap?.(error.info);
          return of(true);
        }
        return throwError(() => error);
      },
    })
  );
}

export interface ILiveOrderBookParams {
  readonly streamHost: string;
  readonly apiHost: string;
  readonly instrument: InstrumentSymbol;
  readonly depth: number;
  readonly updateSpeedMs: Milliseconds;
  readonly restSnapshotLimit: number;
  /** Price bin step passed to the aggregator before snapshots reach the quantizer. */
  readonly aggregationQuoteStep: number;
  readonly reconnectDelayMs?: Milliseconds;
  readonly onSequenceGap?: (info: IOrderBookSequenceGapInfo) => void;
  readonly maxSequenceGapRetries?: number;
  /** Max repeat-last snapshots emitted into empty 1-second buckets. */
  readonly maxInterpolatedSnapshots?: number;
}

export function liveOrderBook$(params: ILiveOrderBookParams): Observable<IQuantizedSnapshot> {
  const {
    streamHost,
    apiHost,
    instrument,
    depth,
    updateSpeedMs,
    restSnapshotLimit,
    aggregationQuoteStep,
    reconnectDelayMs,
    onSequenceGap,
    maxSequenceGapRetries,
    maxInterpolatedSnapshots,
  } = params;

  const restUrl = `${apiHost}/depth?symbol=${instrument.toUpperCase()}&limit=${restSnapshotLimit}`;
  const effectiveReconnectDelayMs = reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;

  return defer(() => {
    const stream$ = createOrderBookStream$({
      streamHost,
      instrument,
      updateSpeedMs,
      depth,
      restUrl,
      onSequenceGap,
      maxSequenceGapRetries,
    });

    // RxJS `retry` reacts to `error`, not to `complete` — but browsers
    // routinely deliver a network drop as a *clean* WebSocket close,
    // which would leave the stream silently finished and never retry.
    // Append a tail observable that errors synchronously on subscribe,
    // so once `stream$` completes we force-trigger the outer retry.
    const closedTrigger$ = defer(() => throwError(() => new OrderBookStreamClosedError()));

    return concat(stream$, closedTrigger$);
  }).pipe(
    retry({ delay: () => awaitReconnectReady(effectiveReconnectDelayMs) }),
    map(data => aggregateSnapshotByBin(toDomainSnapshot(data), aggregationQuoteStep)),
    quantizeBySecond({ maxInterpolatedSnapshots })
  );
}

function toDomainSnapshot(data: IOrderbookSnapshotData): IOrderbookSnapshot {
  return {
    eventTimeMs: data.eventTimeMs,
    bids: data.bids,
    asks: data.asks,
  };
}
