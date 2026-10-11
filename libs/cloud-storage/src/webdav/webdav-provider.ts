import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { isNil, sortBy } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { httpFailureOf } from '../core/http-failure';
import type { TStorageResult } from '../core/storage-error';
import type {
  IStorageObject,
  IStorageProvider,
  TRemoveResult,
  TStoragePath,
} from '../core/storage-provider';
import { isPreconditionMet } from '../core/write-precondition';
import { propfind, statPath } from './propfind';
import { isTemporary } from './temporary-file';
import type { IWebDavFeatures } from './webdav-features';
import { webDavCapabilitiesOf } from './webdav-features';
import type { IWebDavTransport } from './webdav-transport';
import { conflictNow, HTTP_PRECONDITION_FAILED, writeObject } from './webdav-write';

const HTTP_NOT_FOUND = 404;
/** Attempts at a read no other writer cut into before it says the file is too busy. */
const READ_ATTEMPTS = 3;

function nowMs(): Milliseconds {
  return Temporal.Now.instant().epochMilliseconds as Milliseconds;
}

/**
 * The bytes together with the revision they belong to: a `GET` with
 * `If-Match` where the server honours it, else a PROPFIND on both sides of
 * the `GET` that must agree.
 */
async function readPinned(
  transport: IWebDavTransport,
  features: IWebDavFeatures,
  path: TStoragePath,
  signal: AbortSignal
): Promise<TStorageResult<IStorageObject | null>> {
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt += 1) {
    const before = await statPath(transport, path, signal);
    if (!before.ok || isNil(before.value)) {
      return before.ok ? ok(null) : before;
    }
    const headers = features.conditionalRequests ? { 'If-Match': before.value.rev } : undefined;
    const got = await transport.send({ method: 'GET', path, headers }, signal);
    if (!got.ok) {
      return got;
    }
    if (got.value.status === HTTP_NOT_FOUND || got.value.status === HTTP_PRECONDITION_FAILED) {
      continue;
    }
    if (!got.value.ok) {
      return err(httpFailureOf(got.value));
    }
    const bytes = await transport.bytesOf(got.value, signal);
    if (!bytes.ok) {
      return bytes;
    }
    if (features.conditionalRequests) {
      return ok({ bytes: bytes.value, stat: before.value });
    }
    const after = await statPath(transport, path, signal);
    if (!after.ok) {
      return after;
    }
    if (after.value?.rev === before.value.rev) {
      return ok({ bytes: bytes.value, stat: before.value });
    }
  }
  return err({ kind: 'rate-limited', retryAfter: null });
}

/**
 * Any WebDAV server that allows the page's origin: Nextcloud,
 * ownCloud, rclone, Apache, nginx, Caddy. `features` come from the probe
 * made when the account was connected (`webdav-probe.ts`).
 */
export function createWebDavProvider({
  transport,
  features,
  now = nowMs,
}: {
  readonly transport: IWebDavTransport;
  readonly features: IWebDavFeatures;
  readonly now?: () => Milliseconds;
}): IStorageProvider {
  return {
    kind: 'webdav',
    capabilities: webDavCapabilitiesOf(features),
    stat: (path, signal) => statPath(transport, path, signal),
    read: (path, signal) => readPinned(transport, features, path, signal),
    write: (path, bytes, precondition, signal) =>
      writeObject(transport, features, { path, bytes, precondition, now: now() }, signal),
    remove: async (path, precondition, signal): Promise<TStorageResult<TRemoveResult>> => {
      const current = await statPath(transport, path, signal);
      if (!current.ok) {
        return current;
      }
      if (isNil(current.value)) {
        return err({ kind: 'not-found' });
      }
      if (!isPreconditionMet(precondition, current.value)) {
        return ok({ kind: 'conflict', current: current.value });
      }
      const headers =
        features.conditionalRequests && precondition.kind === 'match'
          ? { 'If-Match': precondition.rev }
          : undefined;
      const deleted = await transport.send({ method: 'DELETE', path, headers }, signal);
      if (!deleted.ok) {
        return deleted;
      }
      if (deleted.value.status === HTTP_NOT_FOUND) {
        return err({ kind: 'not-found' });
      }
      if (deleted.value.status === HTTP_PRECONDITION_FAILED) {
        return conflictNow(transport, path, signal);
      }
      return deleted.value.ok ? ok({ kind: 'removed' }) : err(httpFailureOf(deleted.value));
    },
    list: async (directory, signal) => {
      const listed = await propfind(transport, directory, 1, signal);
      if (!listed.ok) {
        return listed;
      }
      const files = (listed.value ?? [])
        .filter(({ stat, isFolder }) => !isFolder && stat.path !== directory)
        .filter(({ stat }) => !isTemporary(stat.path))
        .map(({ stat }) => stat);
      return ok(sortBy(files, stat => stat.path));
    },
  };
}
