import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';

import { httpFailureOf } from '../core/http-failure';
import type { TStorageResult } from '../core/storage-error';
import type { TStoragePath } from '../core/storage-provider';
import { nameOf, parentOf, putCreatingFolders, siblingOf } from './folders';
import { propfind } from './propfind';
import type { IWebDavTransport } from './webdav-transport';

const TEMPORARY_NAME = /^\..+\.[0-9a-f-]{36}\.tmp$/;
const HTTP_PRECONDITION_FAILED = 412;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isTemporary(path: TStoragePath): boolean {
  return TEMPORARY_NAME.test(nameOf(path));
}

/**
 * The bytes go to a hidden `.<name>.<random>.tmp` next to the
 * file and a `MOVE` puts them in place, so a write cut short never leaves
 * half a file; `Overwrite: F` makes a create the server's own check.
 */
export async function replaceThroughTemporary(
  transport: IWebDavTransport,
  path: TStoragePath,
  bytes: Uint8Array<ArrayBuffer>,
  createOnly: boolean,
  signal: AbortSignal
): Promise<TStorageResult<'replaced' | 'exists'>> {
  const temporary = siblingOf(path, `.${nameOf(path)}.${crypto.randomUUID()}.tmp`);
  const put = await putCreatingFolders(transport, temporary, bytes, {}, signal);
  if (!put.ok) {
    return put;
  }
  if (!put.value.ok) {
    return err(httpFailureOf(put.value));
  }
  const moved = await transport.send(
    {
      method: 'MOVE',
      path: temporary,
      headers: { Destination: transport.urlOf(path), Overwrite: createOnly ? 'F' : 'T' },
    },
    signal
  );
  if (moved.ok && moved.value.ok) {
    return ok('replaced');
  }
  await transport.send({ method: 'DELETE', path: temporary }, signal);
  if (!moved.ok) {
    return moved;
  }
  return moved.value.status === HTTP_PRECONDITION_FAILED
    ? ok('exists')
    : err(httpFailureOf(moved.value));
}

/** Leftovers of writes cut short between the PUT and the MOVE, removed once they are a day old. */
export async function sweepTemporaries(
  transport: IWebDavTransport,
  path: TStoragePath,
  now: Milliseconds,
  signal: AbortSignal
): Promise<void> {
  const listed = await propfind(transport, parentOf(path), 1, signal);
  const stale = (listed.ok ? (listed.value ?? []) : []).filter(
    ({ stat, isFolder }) =>
      !isFolder && isTemporary(stat.path) && now - stat.modifiedAt > STALE_AFTER_MS
  );
  for (const { stat } of stale) {
    await transport.send({ method: 'DELETE', path: stat.path }, signal);
  }
}
