import type { Milliseconds } from '@frozik/utils/date/types';

import type { TStorageError } from './storage-error';

const SECOND_MS = 1000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HTTP_INSUFFICIENT_STORAGE = 507;

function retryAfterOf(response: Response): Milliseconds | null {
  const seconds = Number(response.headers.get('Retry-After') ?? Number.NaN);
  return Number.isFinite(seconds) ? ((seconds * SECOND_MS) as Milliseconds) : null;
}

/** What an HTTP answer the caller did not expect means for it. */
export function httpFailureOf(response: Response): TStorageError {
  switch (response.status) {
    case HTTP_UNAUTHORIZED:
      return { kind: 'auth-required' };
    case HTTP_PAYLOAD_TOO_LARGE:
    case HTTP_INSUFFICIENT_STORAGE:
      return { kind: 'quota' };
    case HTTP_TOO_MANY_REQUESTS:
    case HTTP_SERVICE_UNAVAILABLE:
      return { kind: 'rate-limited', retryAfter: retryAfterOf(response) };
    default:
      return { kind: 'server', status: response.status };
  }
}

/**
 * A request that never got an answer: aborted by the caller, or refused by
 * the network — the browser does not tell a host that is down from a CORS
 * refusal, so whoever knows the context (a connection probe) says which.
 */
export function unansweredFailureOf(signal: AbortSignal): TStorageError {
  return signal.aborted ? { kind: 'aborted' } : { kind: 'offline' };
}
