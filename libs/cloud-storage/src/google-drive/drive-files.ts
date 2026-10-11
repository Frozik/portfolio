import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { get, isNil, sortBy } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { TStorageResult } from '../core/storage-error';
import type { IStorageObjectStat, TStoragePath, TStorageRev } from '../core/storage-provider';
import type { TDriveSpace } from './drive-space';
import { DRIVE_LIST_SPACES } from './drive-space';
import type { IDriveTransport } from './drive-transport';
import { DRIVE_API } from './drive-transport';

/** The part of a Drive `File` resource the provider reads. */
export interface IDriveFile {
  readonly id: string;
  readonly name: string;
  readonly isFolder: boolean;
  /** Absent for a folder; a binary file always has one. */
  readonly headRevisionId: string | null;
  readonly size: number;
  readonly modifiedAt: Milliseconds;
  readonly createdAt: Milliseconds;
}

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const FILE_FIELDS = 'id,name,mimeType,headRevisionId,size,modifiedTime,createdTime';
const PAGE_SIZE = 1000;
const HTTP_NOT_FOUND = 404;

function millisecondsOf(value: unknown): Milliseconds {
  return (
    typeof value === 'string' ? Temporal.Instant.from(value).epochMilliseconds : 0
  ) as Milliseconds;
}

/** The wire shape checked once here; nothing past this function sees Drive's JSON. */
export function driveFileOf(json: unknown): IDriveFile | null {
  const id: unknown = get(json, 'id');
  const name: unknown = get(json, 'name');
  if (typeof id !== 'string' || typeof name !== 'string') {
    return null;
  }
  const headRevisionId: unknown = get(json, 'headRevisionId');
  return {
    id,
    name,
    isFolder: get(json, 'mimeType') === FOLDER_MIME,
    headRevisionId: typeof headRevisionId === 'string' ? headRevisionId : null,
    size: Number(get(json, 'size') ?? 0),
    modifiedAt: millisecondsOf(get(json, 'modifiedTime')),
    createdAt: millisecondsOf(get(json, 'createdTime')),
  };
}

export function statOf(file: IDriveFile, path: TStoragePath): IStorageObjectStat {
  return {
    path,
    rev: (file.headRevisionId ?? '') as TStorageRev,
    size: file.size,
    modifiedAt: file.modifiedAt,
  };
}

/** Drive query string literal: a backslash and a single quote are escaped with a backslash. */
function quoted(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/**
 * Drive lets two files share a name in one folder; every reader takes the
 * oldest, so all devices agree on which one the path means.
 */
export function oldestFirst(files: readonly IDriveFile[]): readonly IDriveFile[] {
  return sortBy(files, [file => file.createdAt, file => file.id]);
}

export async function listChildren(
  transport: IDriveTransport,
  space: TDriveSpace,
  parentId: string,
  { name }: { readonly name?: string } = {},
  signal: AbortSignal
): Promise<TStorageResult<readonly IDriveFile[]>> {
  const clauses = [
    `${quoted(parentId)} in parents`,
    'trashed = false',
    ...(isNil(name) ? [] : [`name = ${quoted(name)}`]),
  ];
  const query = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: DRIVE_LIST_SPACES[space],
    fields: `files(${FILE_FIELDS})`,
    pageSize: String(PAGE_SIZE),
  });
  const sent = await transport.send({ method: 'GET', url: `${DRIVE_API}/files?${query}` }, signal);
  if (!sent.ok) {
    return sent;
  }
  const json = await transport.jsonOf(sent.value, signal);
  if (!json.ok) {
    return json;
  }
  const files: unknown = get(json.value, 'files');
  return ok(
    oldestFirst((Array.isArray(files) ? files : []).map(driveFileOf).filter(file => !isNil(file)))
  );
}

/** One file by id; `null` once it is gone (deleted, or trashed by the user in My Drive). */
export async function getFile(
  transport: IDriveTransport,
  fileId: string,
  signal: AbortSignal
): Promise<TStorageResult<IDriveFile | null>> {
  const query = new URLSearchParams({ fields: FILE_FIELDS + ',trashed' });
  const sent = await transport.send(
    { method: 'GET', url: `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${query}` },
    signal,
    [HTTP_NOT_FOUND]
  );
  if (!sent.ok) {
    return sent;
  }
  if (sent.value.status === HTTP_NOT_FOUND) {
    return ok(null);
  }
  const json = await transport.jsonOf(sent.value, signal);
  if (!json.ok) {
    return json;
  }
  const file = driveFileOf(json.value);
  if (isNil(file)) {
    return err({ kind: 'server', status: sent.value.status });
  }
  return ok(get(json.value, 'trashed') === true ? null : file);
}
