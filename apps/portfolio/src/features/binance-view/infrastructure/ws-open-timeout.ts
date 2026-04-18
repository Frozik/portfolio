import { isString } from 'lodash-es';
import type { Observable } from 'rxjs';
import { defer, filter, merge, ReplaySubject, throwError, timeout } from 'rxjs';
import type { WebSocketSubjectConfig } from 'rxjs/webSocket';
import { webSocket } from 'rxjs/webSocket';

export const DEFAULT_WS_OPEN_TIMEOUT_MS = 10_000;

const OPEN_SENTINEL = Symbol('ws-open');

export class WsOpenTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`WebSocket open timeout after ${timeoutMs}ms for ${url}`);
    this.name = 'WsOpenTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Wraps rxjs `webSocket` with an "open timeout": if the connection does
 * not open within `timeoutMs`, the observable errors.
 *
 * The internal `openObserver` delegates to a caller-provided one after
 * emitting the internal sentinel, preserving composability.
 */
export function webSocketWithOpenTimeout<T>(
  config: WebSocketSubjectConfig<T>,
  options?: { timeoutMs?: number }
): Observable<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WS_OPEN_TIMEOUT_MS;
  const url = isString(config.url) ? config.url : '';

  return defer(() => {
    const openSignal$ = new ReplaySubject<typeof OPEN_SENTINEL>(1);
    const callerOpenObserver = config.openObserver;

    const ws$ = webSocket<T>({
      ...config,
      openObserver: {
        next: (event: Event) => {
          openSignal$.next(OPEN_SENTINEL);
          openSignal$.complete();
          callerOpenObserver?.next(event);
        },
      },
    });

    return merge<Array<T | typeof OPEN_SENTINEL>>(openSignal$, ws$).pipe(
      timeout({
        first: timeoutMs,
        with: () => throwError(() => new WsOpenTimeoutError(url, timeoutMs)),
      }),
      filter((value): value is T => value !== OPEN_SENTINEL)
    );
  });
}
