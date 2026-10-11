import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import { httpFailureOf } from '../core/http-failure';
import type { TStorageResult } from '../core/storage-error';
import type { IStorageObjectStat, TStoragePath, TStorageRev } from '../core/storage-provider';
import { parseHttpDate } from './http-date';
import type { IDavEntry } from './multistatus';
import { parseMultistatus, PROPFIND_BODY } from './multistatus';
import type { IWebDavFeatures } from './webdav-features';
import type { IWebDavTransport } from './webdav-transport';

export interface IDavObject {
  readonly stat: IStorageObjectStat;
  readonly isFolder: boolean;
  readonly revisionKind: IWebDavFeatures['revisionKind'] | null;
}

const HTTP_NOT_FOUND = 404;
const UNKNOWN_TIME = 0 as Milliseconds;

/**
 * The revision is the ETag; a server without one gets the
 * modification time with the size, which tells two versions apart only when
 * they were written in different seconds (the probe reports that weaker kind).
 */
function revisionOf({ etag, lastModified, size }: IDavEntry): TStorageRev {
  return (etag ?? `${lastModified ?? ''}|${size}`) as TStorageRev;
}

function revisionKindOf({ etag, lastModified }: IDavEntry): IDavObject['revisionKind'] {
  if (!isNil(etag)) {
    return 'etag';
  }
  return isNil(lastModified) ? null : 'last-modified';
}

function objectOf(entry: IDavEntry, path: TStoragePath): IDavObject {
  return {
    isFolder: entry.isFolder,
    revisionKind: revisionKindOf(entry),
    stat: {
      path,
      rev: revisionOf(entry),
      size: entry.size,
      modifiedAt: isNil(entry.lastModified)
        ? UNKNOWN_TIME
        : (parseHttpDate(entry.lastModified) ?? UNKNOWN_TIME),
    },
  };
}

/** What a path holds — the resource itself, and with `depth: 1` its direct children; `null` where nothing is. */
export async function propfind(
  transport: IWebDavTransport,
  path: TStoragePath,
  depth: 0 | 1,
  signal: AbortSignal
): Promise<TStorageResult<readonly IDavObject[] | null>> {
  const sent = await transport.send(
    {
      method: 'PROPFIND',
      path,
      asFolder: depth === 1,
      headers: { Depth: String(depth), 'Content-Type': 'application/xml; charset=utf-8' },
      body: PROPFIND_BODY,
    },
    signal
  );
  if (!sent.ok) {
    return sent;
  }
  if (sent.value.status === HTTP_NOT_FOUND) {
    return ok(null);
  }
  if (!sent.value.ok) {
    return err(httpFailureOf(sent.value));
  }
  const body = await transport.bytesOf(sent.value, signal);
  if (!body.ok) {
    return body;
  }
  return ok(
    parseMultistatus(new TextDecoder().decode(body.value)).flatMap(entry => {
      const entryPath = transport.pathOf(entry.href);
      return isNil(entryPath) ? [] : [objectOf(entry, entryPath)];
    })
  );
}

export async function statPath(
  transport: IWebDavTransport,
  path: TStoragePath,
  signal: AbortSignal
): Promise<TStorageResult<IStorageObjectStat | null>> {
  const found = await propfind(transport, path, 0, signal);
  if (!found.ok) {
    return found;
  }
  const file = found.value?.find(object => object.stat.path === path && !object.isFolder);
  return ok(file?.stat ?? null);
}
