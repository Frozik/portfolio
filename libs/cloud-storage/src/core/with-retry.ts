import type { Milliseconds } from '@frozik/utils/date/types';
import { err } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { TStorageError, TStorageResult } from './storage-error';
import type { IStorageProvider } from './storage-provider';

export type TRetryWait = (delay: Milliseconds, signal: AbortSignal) => Promise<boolean>;

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const FIRST_SERVER_ERROR = 500;

function isTransient(error: TStorageError): boolean {
  switch (error.kind) {
    case 'offline':
    case 'rate-limited':
      return true;
    case 'server':
      return error.status >= FIRST_SERVER_ERROR;
    default:
      return false;
  }
}

/** Resolves `true` after `delay`, `false` as soon as the caller aborts. */
function waitUnlessAborted(delay: Milliseconds, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Retries a call the provider says may pass later, with
 * exponential backoff and full jitter (a server's `Retry-After` wins), so
 * adapters stay one request per call. A repeated write is safe: if the first
 * one landed unseen, the repeat meets its own revision as a conflict and the
 * caller's merge finds nothing new.
 */
export function withRetry(
  provider: IStorageProvider,
  {
    wait = waitUnlessAborted,
    random = Math.random,
  }: { readonly wait?: TRetryWait; readonly random?: () => number } = {}
): IStorageProvider {
  const retried = async <T>(
    signal: AbortSignal,
    call: () => Promise<TStorageResult<T>>
  ): Promise<TStorageResult<T>> => {
    for (let attempt = 1; ; attempt += 1) {
      const result = await call();
      if (result.ok || !isTransient(result.error) || attempt === MAX_ATTEMPTS) {
        return result;
      }
      const backoff = random() * Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
      const retryAfter = result.error.kind === 'rate-limited' ? result.error.retryAfter : null;
      if (!(await wait((isNil(retryAfter) ? backoff : retryAfter) as Milliseconds, signal))) {
        return err({ kind: 'aborted' });
      }
    }
  };
  const { revisions } = provider;

  return {
    kind: provider.kind,
    capabilities: provider.capabilities,
    stat: (path, signal) => retried(signal, () => provider.stat(path, signal)),
    read: (path, signal) => retried(signal, () => provider.read(path, signal)),
    write: (path, bytes, precondition, signal) =>
      retried(signal, () => provider.write(path, bytes, precondition, signal)),
    remove: (path, precondition, signal) =>
      retried(signal, () => provider.remove(path, precondition, signal)),
    list: (directory, signal) => retried(signal, () => provider.list(directory, signal)),
    ...(isNil(revisions)
      ? {}
      : {
          revisions: (path, signal) =>
            retried(signal, () => revisions.call(provider, path, signal)),
        }),
  };
}
