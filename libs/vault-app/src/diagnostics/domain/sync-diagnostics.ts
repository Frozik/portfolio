import type { TStorageError } from '@frozik/cloud-storage/core/storage-error';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TOpenFailure, TSyncEvent } from '@frozik/vault/sync/sync-events';

import type { IDiagnosticsNote, TDiagnosticsLevel } from './diagnostics-entry';

function storageFields(error: TStorageError): Readonly<Record<string, string>> {
  switch (error.kind) {
    case 'server':
      return { error: error.kind, status: String(error.status) };
    case 'rate-limited':
      return {
        error: error.kind,
        ...(error.retryAfter === null ? {} : { retryAfterMs: String(error.retryAfter) }),
      };
    case 'auth-required':
    case 'offline':
    case 'cors-blocked':
    case 'not-found':
    case 'quota':
    case 'aborted':
    case 'unavailable':
      return { error: error.kind };
    default:
      return assertNever(error);
  }
}

function openFields(failure: TOpenFailure): Readonly<Record<string, string>> {
  return failure.kind === 'key-rotated'
    ? { failure: failure.kind, stale: String(failure.stale) }
    : { failure: failure.kind };
}

/**
 * One replica's sync as the log keeps it: the failures of both, and of the cloud what it wrote and
 * what it met — the local copy is written on every edit, and its successes would drown the rest.
 */
export function syncDiagnostics(
  replica: 'local' | 'cloud',
  event: TSyncEvent
): IDiagnosticsNote | null {
  const note = (
    level: TDiagnosticsLevel,
    name: string,
    fields: Readonly<Record<string, string>> = {}
  ): IDiagnosticsNote => ({ level, category: 'sync', event: name, fields: { replica, ...fields } });
  const cloudOnly = (made: IDiagnosticsNote): IDiagnosticsNote | null =>
    replica === 'cloud' ? made : null;
  switch (event.kind) {
    case 'stat-done':
      return event.result.ok
        ? null
        : note('warn', 'stat-failed', storageFields(event.result.error));
    case 'read-done':
      return event.result.ok
        ? null
        : note('warn', 'read-failed', storageFields(event.result.error));
    case 'opened':
      return event.result.ok
        ? cloudOnly(note('info', 'read', { revision: String(event.result.value.header.revision) }))
        : note('error', 'open-failed', openFields(event.result.error));
    case 'seal-failed':
      return note('warn', 'seal-failed', { failure: event.failure.kind });
    case 'write-done':
      if (!event.result.ok) {
        return note('warn', 'write-failed', storageFields(event.result.error));
      }
      return event.result.value.kind === 'conflict'
        ? note('info', 'write-conflict')
        : cloudOnly(note('info', 'written'));
    case 'retry-due':
      return note('info', 'retry', { attempt: String(event.attempt) });
    case 'merged':
      return event.localHasNews ? cloudOnly(note('info', 'merged-news')) : null;
    case 'online':
      return cloudOnly(note('info', 'online'));
    case 'push-requested':
    case 'pull-requested':
    case 'sealed':
      return null;
    default:
      return assertNever(event);
  }
}
