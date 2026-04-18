import type { Milliseconds } from '@frozik/utils';
import type { Observable } from 'rxjs';
import { fromEvent, take, timer } from 'rxjs';

/**
 * Pick the next retry moment for a WebSocket reconnect: normally a
 * fixed `reconnectDelayMs` back-off, but if the browser reports
 * `navigator.onLine === false` we wait for the `online` event instead
 * of busy-looping against a dead network. Falls back to `timer` when
 * `window` / `navigator` are unavailable (SSR / test runners).
 *
 * Lives in its own module so every Binance WS feed (orderbook,
 * mid-price, …) shares the same reconnect policy without a
 * cross-file import into `orderbook-stream.ts`.
 */
export function awaitReconnectReady(reconnectDelayMs: Milliseconds): Observable<unknown> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || navigator.onLine) {
    return timer(reconnectDelayMs);
  }
  return fromEvent(window, 'online').pipe(take(1));
}
