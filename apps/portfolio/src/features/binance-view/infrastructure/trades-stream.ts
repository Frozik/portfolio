import type { Milliseconds } from '@frozik/utils/date/types';
import type { Observable } from 'rxjs';
import { animationFrameScheduler, bufferTime, EMPTY, of } from 'rxjs';
import { filter, map, mergeMap, retry } from 'rxjs/operators';

import type { ITrade, Quantity, TradeId } from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';

import { awaitReconnectReady } from './await-reconnect-ready';
import type { ICombinedStreamMessage, IRawAggTrade } from './binance-trade-raw.types';
import { webSocketWithOpenTimeout } from './ws-open-timeout';

/**
 * Live `@aggTrade` stream for a single instrument, batched per
 * animation frame (RxJS `bufferTime(0, animationFrameScheduler)`).
 *
 * RAF batching choice — we use the standard RxJS operator rather than
 * a custom Subject-based batcher: `bufferTime(0, animationFrameScheduler)`
 * collapses bursts into one emission per animation frame which is
 * exactly the cadence the renderer needs. The operator is part of
 * RxJS 7.8 and is well documented.
 *
 * Batching verification: empirically confirmed (smoke-test in Chrome
 * 120+) to emit per-RAF — bursts of N trades arriving in the same
 * frame collapse into a single `next` callback, total emitted trade
 * count matches the input. If a future regression shows microtask-
 * frequency emission, fall back to a manual RAF batcher (one
 * `Subject` + `requestAnimationFrame(flush)` is enough); the contract
 * is `Observable<readonly ITrade[]>`, so callers won't need to change.
 *
 * Endpoint: `wss://<host>/stream?streams=<instrument>@aggTrade` —
 * the *combined-stream* wrapper (so future addition of orderbook on
 * the same socket is a no-op). Each WS message is shaped as
 * `{ stream, data }` where `data` is the {@link IRawAggTrade}.
 *
 * Validation: malformed messages (non-finite numeric strings,
 * non-integer trade ids, etc.) are dropped silently. We never let a
 * single bad payload error the outer stream — Binance occasionally
 * delivers control frames or partial messages on reconnect, and
 * surfacing them as RxJS errors would force a full reconnect loop.
 *
 * Reconnect policy: identical to `liveOrderBook$` — `retry({ delay:
 * () => awaitReconnectReady(reconnectDelayMs) })`. Honors
 * `navigator.onLine` to avoid busy-looping against a dead network.
 */

const DEFAULT_RECONNECT_DELAY_MS: Milliseconds = 1000 as Milliseconds;

export interface ILiveTradesParams {
  readonly streamHost: string;
  readonly instrument: string;
  readonly reconnectDelayMs?: Milliseconds;
}

export function liveTrades$(params: ILiveTradesParams): Observable<ReadonlyArray<ITrade>> {
  const { streamHost, instrument, reconnectDelayMs } = params;
  const effectiveReconnectDelayMs = reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const lowerInstrument = instrument.toLowerCase();
  const wsUrl = `${streamHost}/stream?streams=${lowerInstrument}@aggTrade`;
  const expectedStreamName = `${lowerInstrument}@aggTrade`;

  return webSocketWithOpenTimeout<ICombinedStreamMessage<IRawAggTrade>>({ url: wsUrl }).pipe(
    filter(message => message.stream === expectedStreamName),
    map(message => mapRawAggTradeToITrade(message.data)),
    mergeMap(trade => (trade === null ? EMPTY : of(trade))),
    bufferTime<ITrade>(0, animationFrameScheduler),
    filter(batch => batch.length > 0),
    retry({ delay: () => awaitReconnectReady(effectiveReconnectDelayMs) })
  );
}

/**
 * Validates and normalises a raw `@aggTrade` payload into the domain
 * {@link ITrade} shape. Returns `null` on any validation failure so
 * the caller can drop the message via `mergeMap` without erroring the
 * outer stream.
 *
 * Exported for unit tests.
 */
export function mapRawAggTradeToITrade(raw: IRawAggTrade): ITrade | null {
  const price = Number.parseFloat(raw.p);
  // Strictly positive — the bucket accumulator's `closeBucket` asserts
  // `volumeTotal > 0` / `notionalSum > 0`, so a zero or negative leg
  // here would crash the closeBucket path on the next second-rollover.
  // Binance never emits zero-priced or zero-qty trades on real
  // markets; rejecting them keeps the assert path defensible against
  // malformed payloads (e.g. partial WS frames on reconnect).
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }
  const quantity = Number.parseFloat(raw.q);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  if (!Number.isFinite(raw.a) || !Number.isInteger(raw.a)) {
    return null;
  }
  if (!Number.isFinite(raw.T)) {
    return null;
  }
  return {
    tradeId: raw.a as TradeId,
    eventTimeMs: raw.T as UnixTimeMs,
    price,
    quantity: quantity as Quantity,
    isBuyerMaker: raw.m,
  };
}
