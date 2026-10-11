import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import { httpFailureOf } from '../core/http-failure';
import type { TStorageResult } from '../core/storage-error';
import type {
  IStorageObjectStat,
  TStoragePath,
  TStorageRev,
  TWritePrecondition,
  TWriteResult,
} from '../core/storage-provider';
import { isPreconditionMet } from '../core/write-precondition';
import { putCreatingFolders } from './folders';
import { statPath } from './propfind';
import { replaceThroughTemporary, sweepTemporaries } from './temporary-file';
import type { IWebDavFeatures } from './webdav-features';
import type { IWebDavTransport } from './webdav-transport';

export const HTTP_PRECONDITION_FAILED = 412;

export interface IWriteRequest {
  readonly path: TStoragePath;
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly precondition: TWritePrecondition;
  readonly now: Milliseconds;
}

export function conditionHeadersOf(precondition: TWritePrecondition): Record<string, string> {
  switch (precondition.kind) {
    case 'absent':
      return { 'If-None-Match': '*' };
    case 'match':
      return { 'If-Match': precondition.rev };
    case 'overwrite':
      return {};
    default:
      return assertNever(precondition);
  }
}

export async function conflictNow(
  transport: IWebDavTransport,
  path: TStoragePath,
  signal: AbortSignal
): Promise<
  TStorageResult<{ readonly kind: 'conflict'; readonly current: IStorageObjectStat | null }>
> {
  const current = await statPath(transport, path, signal);
  return current.ok ? ok({ kind: 'conflict', current: current.value }) : current;
}

/**
 * The stat of what was just written. Between the PUT and this PROPFIND
 * another writer may have replaced it; when the PUT's own ETag is readable
 * (the server exposes it to CORS) it wins, so the next conditional write
 * fails against that writer instead of silently overwriting it.
 */
async function writtenStat(
  transport: IWebDavTransport,
  path: TStoragePath,
  ownEtag: string | null,
  signal: AbortSignal
): Promise<TStorageResult<TWriteResult>> {
  const stat = await statPath(transport, path, signal);
  if (!stat.ok) {
    return stat;
  }
  if (isNil(stat.value)) {
    return ok({ kind: 'conflict', current: null });
  }
  const rev = isNil(ownEtag) ? stat.value.rev : (ownEtag as TStorageRev);
  return ok({ kind: 'ok', stat: { ...stat.value, rev } });
}

/** `conditionalWrite: 'atomic'` — the server compares and writes in one request. */
async function writeConditionally(
  transport: IWebDavTransport,
  { path, bytes, precondition }: IWriteRequest,
  signal: AbortSignal
): Promise<TStorageResult<TWriteResult>> {
  const put = await putCreatingFolders(
    transport,
    path,
    bytes,
    conditionHeadersOf(precondition),
    signal
  );
  if (!put.ok) {
    return put;
  }
  if (put.value.status === HTTP_PRECONDITION_FAILED) {
    return conflictNow(transport, path, signal);
  }
  if (!put.value.ok) {
    return err(httpFailureOf(put.value));
  }
  return writtenStat(transport, path, put.value.headers.get('ETag'), signal);
}

/**
 * `'check-then-write'` — the precondition is checked by a
 * PROPFIND first; only a create stays the server's check (`MOVE` with
 * `Overwrite: F`), a replacement narrows the race without closing it.
 */
async function writeCheckingFirst(
  transport: IWebDavTransport,
  features: IWebDavFeatures,
  { path, bytes, precondition, now }: IWriteRequest,
  signal: AbortSignal
): Promise<TStorageResult<TWriteResult>> {
  const current = await statPath(transport, path, signal);
  if (!current.ok) {
    return current;
  }
  if (!isPreconditionMet(precondition, current.value)) {
    return ok({ kind: 'conflict', current: current.value });
  }
  if (!features.moveReplace) {
    const put = await putCreatingFolders(transport, path, bytes, {}, signal);
    if (!put.ok) {
      return put;
    }
    return put.value.ok
      ? writtenStat(transport, path, null, signal)
      : err(httpFailureOf(put.value));
  }
  const replaced = await replaceThroughTemporary(
    transport,
    path,
    bytes,
    precondition.kind === 'absent',
    signal
  );
  if (!replaced.ok) {
    return replaced;
  }
  if (replaced.value === 'exists') {
    return conflictNow(transport, path, signal);
  }
  await sweepTemporaries(transport, path, now, signal);
  return writtenStat(transport, path, null, signal);
}

export function writeObject(
  transport: IWebDavTransport,
  features: IWebDavFeatures,
  request: IWriteRequest,
  signal: AbortSignal
): Promise<TStorageResult<TWriteResult>> {
  return features.conditionalRequests
    ? writeConditionally(transport, request, signal)
    : writeCheckingFirst(transport, features, request, signal);
}
