import { err, ok } from '@frozik/utils/result/result';
import { get, isNil } from 'lodash-es';

import { httpFailureOf, unansweredFailureOf } from '../core/http-failure';
import type { TStorageError, TStorageResult } from '../core/storage-error';
import type { IAccessTokenSource } from './access-token';

export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export interface IDriveRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: BodyInit;
}

export interface IDriveTransport {
  /** An answer with any status the caller expects (404 included), or the failure it means. */
  send(
    request: IDriveRequest,
    signal: AbortSignal,
    expected?: readonly number[]
  ): Promise<TStorageResult<Response>>;
  jsonOf(response: Response, signal: AbortSignal): Promise<TStorageResult<unknown>>;
  bytesOf(
    response: Response,
    signal: AbortSignal
  ): Promise<TStorageResult<Uint8Array<ArrayBuffer>>>;
}

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const RATE_LIMIT_REASONS: ReadonlySet<string> = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
]);
const QUOTA_REASONS: ReadonlySet<string> = new Set(['storageQuotaExceeded', 'quotaExceeded']);

/** Drive answers both "slow down" and "Drive is full" with 403 and says which in the body. */
async function forbiddenFailureOf(response: Response): Promise<TStorageError> {
  const body: unknown = await response.json().catch(() => null);
  const errors: unknown = get(body, ['error', 'errors']);
  const reasons: readonly string[] = Array.isArray(errors)
    ? errors.map(error => String(get(error, 'reason')))
    : [];
  if (reasons.some(reason => RATE_LIMIT_REASONS.has(reason))) {
    return { kind: 'rate-limited', retryAfter: null };
  }
  return reasons.some(reason => QUOTA_REASONS.has(reason))
    ? { kind: 'quota' }
    : { kind: 'server', status: HTTP_FORBIDDEN };
}

export function createDriveTransport(
  tokens: IAccessTokenSource,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): IDriveTransport {
  return {
    send: async ({ method, url, headers, body }, signal, expected = []) => {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      const token = await tokens.token(signal);
      if (!token.ok) {
        return token;
      }
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: { Authorization: `Bearer ${token.value}`, ...headers },
          body,
          signal,
          cache: 'no-store',
          credentials: 'omit',
        });
      } catch {
        return err(unansweredFailureOf(signal));
      }
      if (response.ok || expected.includes(response.status)) {
        return ok(response);
      }
      if (response.status === HTTP_UNAUTHORIZED) {
        tokens.invalidate();
      }
      return err(
        response.status === HTTP_FORBIDDEN
          ? await forbiddenFailureOf(response)
          : httpFailureOf(response)
      );
    },
    jsonOf: async (response, signal) => {
      try {
        const json: unknown = await response.json();
        return isNil(json) ? err({ kind: 'server', status: response.status }) : ok(json);
      } catch {
        return err(
          signal.aborted ? { kind: 'aborted' } : { kind: 'server', status: response.status }
        );
      }
    },
    bytesOf: async (response, signal) => {
      try {
        return ok(new Uint8Array(await response.arrayBuffer()));
      } catch {
        return err(unansweredFailureOf(signal));
      }
    },
  };
}
