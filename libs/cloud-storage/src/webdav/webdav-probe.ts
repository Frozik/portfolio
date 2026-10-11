import { err, ok } from '@frozik/utils/result/result';
import type { TResult } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import { httpFailureOf } from '../core/http-failure';
import type { TStorageError } from '../core/storage-error';
import type { TStoragePath } from '../core/storage-provider';
import { propfind } from './propfind';
import type { IWebDavFeatures } from './webdav-features';
import type { IWebDavTransport } from './webdav-transport';
import { HTTP_PRECONDITION_FAILED } from './webdav-write';

export type TWebDavProbeFailure =
  | TStorageError
  | { readonly kind: 'not-a-folder' }
  /** Neither an ETag nor a modification time: two versions of the file cannot be told apart. */
  | { readonly kind: 'no-revisions' };

const ROOT = '' as TStoragePath;
const MISMATCHED_ETAG = '"pwv-probe-mismatch"';
const PROBE_BYTES = new TextEncoder().encode('pwv probe');
/** The probe's files go even when the check itself was cancelled. */
const CLEANUP_TIMEOUT_MS = 10_000;

/** Named like the provider's temporary files, so a cleanup that never reached the server is swept later. */
function probePath(role: string): TStoragePath {
  return `.pwv-${role}.${crypto.randomUUID()}.tmp` as TStoragePath;
}

function removeQuietly(transport: IWebDavTransport, path: TStoragePath): Promise<unknown> {
  return transport.send({ method: 'DELETE', path }, AbortSignal.timeout(CLEANUP_TIMEOUT_MS));
}

/**
 * Whether the server answered a request with 412 — a refused precondition. A
 * request that got no answer counts as "no": in a browser that is the CORS
 * preflight refusing a header the server does not list, so it does not honour it either.
 */
async function refusedWith412(
  transport: IWebDavTransport,
  request: Parameters<IWebDavTransport['send']>[0],
  signal: AbortSignal
): Promise<boolean> {
  const sent = await transport.send(request, signal);
  return sent.ok && sent.value.status === HTTP_PRECONDITION_FAILED;
}

/** A server that refuses every `If-Match` (weak ETags compared strongly) would turn each write into a conflict. */
async function acceptedWithItsOwnEtag(
  transport: IWebDavTransport,
  path: TStoragePath,
  etag: string,
  signal: AbortSignal
): Promise<boolean> {
  const sent = await transport.send(
    { method: 'PUT', path, body: PROBE_BYTES, headers: { 'If-Match': etag } },
    signal
  );
  return sent.ok && sent.value.ok;
}

async function probeMoveReplace(
  transport: IWebDavTransport,
  target: TStoragePath,
  signal: AbortSignal
): Promise<boolean> {
  const source = probePath('probe-move');
  const put = await transport.send({ method: 'PUT', path: source, body: PROBE_BYTES }, signal);
  if (!put.ok || !put.value.ok) {
    return false;
  }
  const move = (overwrite: 'T' | 'F') =>
    transport.send(
      {
        method: 'MOVE',
        path: source,
        headers: { Destination: transport.urlOf(target), Overwrite: overwrite },
      },
      signal
    );
  const refused = await move('F');
  const replaced = await move('T');
  await removeQuietly(transport, source);
  return (
    refused.ok &&
    refused.value.status === HTTP_PRECONDITION_FAILED &&
    replaced.ok &&
    replaced.value.ok
  );
}

/**
 * Run once when an account is connected: can the page reach
 * the folder at all, which revisions does the server give, does it do the
 * compare-and-swap itself and can it replace a file in one `MOVE`. Leaves
 * nothing behind but what a failed cleanup could not remove.
 */
export async function probeWebDav(
  transport: IWebDavTransport,
  signal: AbortSignal
): Promise<TResult<IWebDavFeatures, TWebDavProbeFailure>> {
  const folder = await propfind(transport, ROOT, 0, signal);
  if (!folder.ok) {
    return err(folder.error.kind === 'offline' ? { kind: 'cors-blocked' } : folder.error);
  }
  if (!(folder.value ?? []).some(object => object.isFolder)) {
    return err({ kind: 'not-a-folder' });
  }

  const trial = probePath('probe');
  const put = await transport.send({ method: 'PUT', path: trial, body: PROBE_BYTES }, signal);
  if (!put.ok) {
    return put;
  }
  if (!put.value.ok) {
    return err(httpFailureOf(put.value));
  }
  try {
    const written = await propfind(transport, trial, 0, signal);
    if (!written.ok) {
      return written;
    }
    const trialObject = written.value?.find(object => object.stat.path === trial);
    const revisionKind = trialObject?.revisionKind;
    if (isNil(trialObject) || isNil(revisionKind)) {
      return err({ kind: 'no-revisions' });
    }
    const conditionalRequests =
      revisionKind === 'etag' &&
      (await refusedWith412(
        transport,
        { method: 'PUT', path: trial, body: PROBE_BYTES, headers: { 'If-Match': MISMATCHED_ETAG } },
        signal
      )) &&
      (await refusedWith412(
        transport,
        { method: 'PUT', path: trial, body: PROBE_BYTES, headers: { 'If-None-Match': '*' } },
        signal
      )) &&
      (await acceptedWithItsOwnEtag(transport, trial, trialObject.stat.rev, signal));
    const moveReplace = await probeMoveReplace(transport, trial, signal);
    if (signal.aborted) {
      return err({ kind: 'aborted' });
    }
    return ok({ conditionalRequests, moveReplace, revisionKind });
  } finally {
    await removeQuietly(transport, trial);
  }
}
