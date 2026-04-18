import type { Milliseconds } from '@frozik/utils';
import { nowEpochMs } from '@frozik/utils';
import type { Observable } from 'rxjs';
import { concat, defer, from, of, throwError } from 'rxjs';
import { finalize, map, retry, tap } from 'rxjs/operators';

import { aggregateSnapshotByBin } from '../domain/aggregate-snapshot';
import type { IOrderbookSnapshot, IQuantizedSnapshot, UnixTimeMs } from '../domain/types';

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

function generateInterpolatedSnapshots(
  lastSnapshot: IOrderbookSnapshotData,
  disconnectTimeMs: UnixTimeMs,
  reconnectTimeMs: UnixTimeMs,
  updateIntervalMs: Milliseconds
): IOrderbookSnapshotData[] {
  const snapshots: IOrderbookSnapshotData[] = [];
  const duration = reconnectTimeMs - disconnectTimeMs;

  if (duration <= 0) {
    return snapshots;
  }

  const count = Math.ceil(duration / updateIntervalMs);

  for (let index = 1; index <= count; index++) {
    const interpolatedTimeMs = (disconnectTimeMs + index * updateIntervalMs) as UnixTimeMs;
    if (interpolatedTimeMs >= reconnectTimeMs) {
      break;
    }
    snapshots.push({ ...lastSnapshot, eventTimeMs: interpolatedTimeMs });
  }

  return snapshots;
}

function createOrderBookStream$(params: {
  streamHost: string;
  instrument: string;
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
  readonly instrument: string;
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

  let lastSnapshot: IOrderbookSnapshotData | null = null;
  let disconnectTimeMs: UnixTimeMs | null = null;
  let isFirstConnection = true;

  return defer(() => {
    let interpolatedSnapshots: IOrderbookSnapshotData[] = [];
    let savedDisconnectTimeMs: UnixTimeMs | null = null;

    if (lastSnapshot !== null && disconnectTimeMs !== null && !isFirstConnection) {
      savedDisconnectTimeMs = disconnectTimeMs;
      disconnectTimeMs = null;
    }

    const stream$ = createOrderBookStream$({
      streamHost,
      instrument,
      updateSpeedMs,
      depth,
      restUrl,
      onSequenceGap,
      maxSequenceGapRetries,
    }).pipe(
      tap(snapshot => {
        if (savedDisconnectTimeMs !== null && lastSnapshot !== null) {
          const reconnectTimeMs = nowEpochMs() as UnixTimeMs;
          interpolatedSnapshots = generateInterpolatedSnapshots(
            lastSnapshot,
            savedDisconnectTimeMs,
            reconnectTimeMs,
            updateSpeedMs
          );
          savedDisconnectTimeMs = null;
        }
        lastSnapshot = snapshot;
        isFirstConnection = false;
      }),
      finalize(() => {
        if (lastSnapshot !== null && !isFirstConnection) {
          disconnectTimeMs = nowEpochMs() as UnixTimeMs;
        }
      })
    );

    // RxJS `retry` reacts to `error`, not to `complete` — but browsers
    // routinely deliver a network drop as a *clean* WebSocket close,
    // which would leave the stream silently finished and never retry.
    // Append a tail observable that errors synchronously on subscribe,
    // so once `stream$` completes we force-trigger the outer retry.
    const closedTrigger$ = defer(() => throwError(() => new OrderBookStreamClosedError()));

    if (interpolatedSnapshots.length > 0) {
      return concat(from(interpolatedSnapshots), stream$, closedTrigger$);
    }

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
