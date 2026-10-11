import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { TStorageResult } from '../core/storage-error';
import type { TStoragePath } from '../core/storage-provider';
import type { IDriveFile } from './drive-files';
import { driveFileOf, FILE_FIELDS, FOLDER_MIME, listChildren } from './drive-files';
import type { TDriveSpace } from './drive-space';
import { DRIVE_ROOTS } from './drive-space';
import type { IDriveTransport } from './drive-transport';
import { DRIVE_API } from './drive-transport';

const SEPARATOR = '/';

export function parentOf(path: TStoragePath): TStoragePath {
  return path.slice(0, Math.max(path.lastIndexOf(SEPARATOR), 0)) as TStoragePath;
}

export function nameOf(path: TStoragePath): string {
  return path.slice(path.lastIndexOf(SEPARATOR) + 1);
}

export function childPath(folder: TStoragePath, name: string): TStoragePath {
  return (folder === '' ? name : `${folder}${SEPARATOR}${name}`) as TStoragePath;
}

export function deleteFile(
  transport: IDriveTransport,
  fileId: string,
  signal: AbortSignal
): Promise<TStorageResult<Response>> {
  return transport.send(
    { method: 'DELETE', url: `${DRIVE_API}/files/${encodeURIComponent(fileId)}` },
    signal
  );
}

async function createFolder(
  transport: IDriveTransport,
  parentId: string,
  name: string,
  signal: AbortSignal
): Promise<TStorageResult<IDriveFile>> {
  const sent = await transport.send(
    {
      method: 'POST',
      url: `${DRIVE_API}/files?fields=${FILE_FIELDS}`,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    },
    signal
  );
  if (!sent.ok) {
    return sent;
  }
  const json = await transport.jsonOf(sent.value, signal);
  const folder = json.ok ? driveFileOf(json.value) : null;
  return isNil(folder) ? err({ kind: 'server', status: sent.value.status }) : ok(folder);
}

/**
 * Two devices creating the same folder at once make two; both keep the
 * oldest (`oldestFirst`), and the one that lost removes its own empty copy.
 */
async function createdOnce(
  transport: IDriveTransport,
  space: TDriveSpace,
  parentId: string,
  name: string,
  signal: AbortSignal
): Promise<TStorageResult<string>> {
  const created = await createFolder(transport, parentId, name, signal);
  if (!created.ok) {
    return created;
  }
  const siblings = await listChildren(transport, space, parentId, { name }, signal);
  if (!siblings.ok) {
    return siblings;
  }
  const kept = siblings.value.find(file => file.isFolder) ?? created.value;
  if (kept.id !== created.value.id) {
    await deleteFile(transport, created.value.id, signal);
  }
  return ok(kept.id);
}

/**
 * The id of a folder path, walked from the space's root one name at a time;
 * `null` when a folder on the way is missing and `create` is off. Nothing is
 * cached: a user may delete or rename the folder in Drive at any moment.
 */
export async function folderIdOf(
  transport: IDriveTransport,
  space: TDriveSpace,
  folder: TStoragePath,
  create: boolean,
  signal: AbortSignal
): Promise<TStorageResult<string | null>> {
  let parentId = DRIVE_ROOTS[space];
  for (const name of folder.split(SEPARATOR).filter(segment => segment !== '')) {
    const children = await listChildren(transport, space, parentId, { name }, signal);
    if (!children.ok) {
      return children;
    }
    const existing = children.value.find(file => file.isFolder);
    if (!isNil(existing)) {
      parentId = existing.id;
      continue;
    }
    if (!create) {
      return ok(null);
    }
    const created = await createdOnce(transport, space, parentId, name, signal);
    if (!created.ok) {
      return created;
    }
    parentId = created.value;
  }
  return ok(parentId);
}

/** The file a path names — the oldest of same-named ones — or `null`. */
export async function fileAt(
  transport: IDriveTransport,
  space: TDriveSpace,
  path: TStoragePath,
  signal: AbortSignal
): Promise<TStorageResult<{ readonly parentId: string; readonly file: IDriveFile | null } | null>> {
  const parentId = await folderIdOf(transport, space, parentOf(path), false, signal);
  if (!parentId.ok || isNil(parentId.value)) {
    return parentId.ok ? ok(null) : parentId;
  }
  const children = await listChildren(
    transport,
    space,
    parentId.value,
    { name: nameOf(path) },
    signal
  );
  if (!children.ok) {
    return children;
  }
  return ok({
    parentId: parentId.value,
    file: children.value.find(file => !file.isFolder) ?? null,
  });
}
